import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { QueueService } from "../src/common/jobs/queue.service";
import { RemindersService } from "../src/modules/reminders/reminders.service";

const stamp = Date.now().toString(36);
const ownerEmail = `owner-${stamp}@example.org`;
const otherEmail = `other-${stamp}@example.org`;
const guestEmail = `guest-${stamp}@example.org`;
const digestEmail = `digest-${stamp}@example.org`;

describe("phase 1", () => {
  let app: INestApplication;
  let owner: request.Agent;
  let other: request.Agent;
  let csrf = "";
  let orgId = "";
  let orgSlug = "";

  beforeAll(async () => {
    app = await createApp();
    bindApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("issues a CSRF token on the first response", async () => {
    owner = request.agent(app.getHttpServer());
    const response = await owner.get("/api/v1/auth/csrf");
    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.length).toBeGreaterThan(20);
    csrf = response.body.token as string;
    expect(headerText(response.headers["set-cookie"])).toContain("se_csrf");
  });

  it("answers login requests without revealing whether the email exists", async () => {
    const known = await owner
      .post("/api/v1/auth/login-request")
      .set("x-csrf-token", csrf)
      .send({ email: ownerEmail });
    const unknown = await owner
      .post("/api/v1/auth/login-request")
      .set("x-csrf-token", csrf)
      .send({ email: `nobody-${stamp}@example.org` });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("signs in with the emailed code and rejects a second use", async () => {
    const code = await latestCode(ownerEmail);
    const bad = await owner
      .post("/api/v1/auth/verify")
      .set("x-csrf-token", csrf)
      .send({ email: ownerEmail, code: "000000" });
    expect(bad.status).toBe(400);
    const ok = await owner
      .post("/api/v1/auth/verify")
      .set("x-csrf-token", csrf)
      .send({ email: ownerEmail, code });
    expect(ok.status).toBe(200);
    expect(headerText(ok.headers["set-cookie"])).toContain("se_session");
    expect(headerText(ok.headers["set-cookie"])).not.toContain("Secure");
    const again = await owner
      .post("/api/v1/auth/verify")
      .set("x-csrf-token", csrf)
      .send({ email: ownerEmail, code });
    expect(again.status).toBe(400);
    const me = await owner.get("/api/v1/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ownerEmail);
  });

  it("creates an organization and makes the creator the owner", async () => {
    const created = await owner
      .post("/api/v1/orgs")
      .set("x-csrf-token", csrf)
      .send({
        name: `Harbor Friends ${stamp}`,
        type: "NONPROFIT_501C3",
        community: "Juneau",
        focusAreas: ["Education & Youth"],
        receivesFederalFunds: false,
      });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBeTruthy();
    expect(created.body.suggestedTemplates.length).toBeGreaterThan(0);
    orgId = created.body.id as string;
    orgSlug = created.body.slug as string;
    const members = await owner.get(`/api/v1/orgs/${orgId}/members`);
    expect(members.body[0].role).toBe("OWNER");
    expect(members.body[0].email).toBe(ownerEmail);
  });

  it("hides the organization from someone who is not a member", async () => {
    other = (await signIn(otherEmail)).agent;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const paths = [
      ["get", `/api/v1/orgs/${orgId}`],
      ["get", `/api/v1/orgs/${orgId}/members`],
      ["get", `/api/v1/orgs/${orgId}/documents`],
      ["get", `/api/v1/orgs/${orgId}/content-blocks`],
      ["get", `/api/v1/orgs/${orgId}/applications`],
      ["get", `/api/v1/orgs/${orgId}/compliance`],
      ["get", `/api/v1/orgs/${orgId}/dashboard`],
      [
        "get",
        `/api/v1/orgs/${orgId}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ],
      ["get", `/api/v1/orgs/${orgId}/invitations`],
    ] as const;
    for (const [method, path] of paths) {
      const response = await other[method](path).set("x-csrf-token", csrf);
      expect(response.status, path).toBe(404);
    }
  });

  it("accepts a pending invitation on first sign-in and blocks a viewer from inviting", async () => {
    const invited = await owner
      .post(`/api/v1/orgs/${orgId}/invitations`)
      .set("x-csrf-token", csrf)
      .send({ email: guestEmail, role: "VIEWER" });
    expect(invited.status).toBe(201);
    const guest = await signIn(guestEmail);
    const orgs = await guest.agent.get("/api/v1/orgs");
    expect(orgs.body.some((org: { id: string }) => org.id === orgId)).toBe(true);
    const denied = await guest.agent
      .post(`/api/v1/orgs/${orgId}/invitations`)
      .set("x-csrf-token", guest.csrf)
      .send({ email: `extra-${stamp}@example.org`, role: "VIEWER" });
    expect(denied.status).toBe(403);
    const members = await owner.get(`/api/v1/orgs/${orgId}/members`);
    const ownerRow = (members.body as { id: string; role: string }[]).find(
      (row) => row.role === "OWNER",
    );
    const demote = await owner
      .patch(`/api/v1/orgs/${orgId}/members/${ownerRow?.id}`)
      .set("x-csrf-token", csrf)
      .send({ role: "ADMIN" });
    expect(demote.status).toBe(409);
  });

  it("stores a vault file only after the upload matches", async () => {
    const body = Buffer.from("hello");
    const signed = await owner
      .post(`/api/v1/orgs/${orgId}/documents/upload-url`)
      .set("x-csrf-token", csrf)
      .send({
        filename: "letter.txt",
        mimeType: "text/plain",
        sizeBytes: body.length,
      });
    expect(signed.status).toBe(201);
    const upload = new URL(signed.body.uploadUrl as string);
    const put = await owner
      .put(`${upload.pathname}${upload.search}`)
      .set("content-type", "text/plain")
      .send(body);
    expect(put.status).toBe(204);
    const expires = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const created = await owner
      .post(`/api/v1/orgs/${orgId}/documents`)
      .set("x-csrf-token", csrf)
      .send({
        storageKey: signed.body.storageKey,
        kind: "IRS_DETERMINATION_LETTER",
        title: "IRS letter",
        mimeType: "text/plain",
        sizeBytes: body.length,
        expiresAt: expires,
      });
    expect(created.status).toBe(201);
    const download = await owner.get(
      `/api/v1/orgs/${orgId}/documents/${created.body.id}/download-url`,
    );
    expect(download.status).toBe(200);
    expect(download.body.expiresInSeconds).toBe(300);
    const listed = await owner.get(`/api/v1/orgs/${orgId}/documents`);
    expect(listed.body.packetMissing).not.toContain("IRS_DETERMINATION_LETTER");
  });

  it("sends a reminder through the memory mailbox", async () => {
    const queue = app.get(QueueService);
    const job = [...queue.memory].reverse().find((item) => item.name === "reminders:send");
    expect(job?.data).toMatchObject({ reminderId: expect.any(String) });
    await app.get(RemindersService).send((job?.data as { reminderId: string }).reminderId);
    const mail = await request(app.getHttpServer())
      .get("/api/v1/test/mailbox")
      .query({ email: ownerEmail });
    const subjects = (mail.body.messages as { subject: string }[]).map(
      (message) => message.subject,
    );
    expect(subjects.some((subject) => subject.startsWith("Due in"))).toBe(true);
  });

  it("versions a content block and restores it", async () => {
    const created = await owner
      .post(`/api/v1/orgs/${orgId}/content-blocks`)
      .set("x-csrf-token", csrf)
      .send({
        category: "MISSION",
        title: "Mission",
        body: "We serve Juneau families.",
      });
    expect(created.status).toBe(201);
    expect(created.body.wordCount).toBe(4);
    const updated = await owner
      .patch(`/api/v1/orgs/${orgId}/content-blocks/${created.body.id}`)
      .set("x-csrf-token", csrf)
      .send({ body: "We serve Juneau families and elders." });
    expect(updated.body.version).toBe(2);
    const restored = await owner
      .post(`/api/v1/orgs/${orgId}/content-blocks/${created.body.id}/restore/1`)
      .set("x-csrf-token", csrf);
    expect(restored.body.body).toBe("We serve Juneau families.");
    expect(restored.body.version).toBe(3);
  });

  it("publishes an opportunity with a fit label and a two-zone deadline", async () => {
    await app
      .get(PrismaService)
      .db.user.update({ where: { email: ownerEmail }, data: { platformRole: "SUPERADMIN" } });
    const funder = await owner
      .post("/api/v1/admin/funders")
      .set("x-csrf-token", csrf)
      .send({
        name: `Test Foundation ${stamp}`,
        type: "PRIVATE_FOUNDATION",
        isPublished: true,
        curatorNotes: `SECRET-NOTE-${stamp}`,
      });
    expect(funder.status).toBe(201);
    const deadline = new Date("2026-06-15T03:59:00.000Z").toISOString();
    const opportunity = await owner
      .post("/api/v1/admin/opportunities")
      .set("x-csrf-token", csrf)
      .send({
        funderId: funder.body.id,
        title: `Youth program ${stamp}`,
        summary: "Support after-school programs in Juneau.",
        deadlineType: "FIXED",
        deadlineAt: deadline,
        deadlineTimezone: "America/New_York",
        eligibleOrgTypes: ["NONPROFIT_501C3"],
        eligibleCommunities: ["Juneau"],
        focusAreas: ["Education & Youth"],
        status: "OPEN",
        isPublic: true,
        requiresSam: true,
        curatorNotes: `SECRET-NOTE-${stamp}`,
      });
    expect(opportunity.status).toBe(201);
    const listed = await owner.get(
      `/api/v1/opportunities?fitForOrgId=${orgId}&q=${encodeURIComponent(stamp)}`,
    );
    const row = (
      listed.body.items as {
        slug: string;
        fit: { text: string };
        deadline: { timezonesDiffer: boolean };
        samWarning: string | null;
      }[]
    )[0];
    expect(row?.fit.text).toBe("Good fit");
    expect(row?.deadline.timezonesDiffer).toBe(true);
    expect(row?.samWarning).toContain("SAM.gov");
    const page = await request(app.getHttpServer()).get(`/grants/${row?.slug}`);
    expect(page.status).toBe(200);
    expect(page.text).not.toContain(`SECRET-NOTE-${stamp}`);
    expect(page.text).toContain("Youth program");
    const started = await owner
      .post(`/api/v1/orgs/${orgId}/applications/from-opportunity/${opportunity.body.id}`)
      .set("x-csrf-token", csrf);
    expect(started.status).toBe(201);
    expect(started.body.checklist.length).toBeGreaterThan(0);
    expect(started.body.internalDueAt).toBeTruthy();
    const declined = await owner
      .patch(`/api/v1/orgs/${orgId}/applications/${started.body.id}`)
      .set("x-csrf-token", csrf)
      .send({ status: "DECLINED" });
    expect(declined.status).toBe(400);
  });

  it("rolls a compliance date forward when marked complete", async () => {
    const created = await owner
      .post(`/api/v1/orgs/${orgId}/compliance`)
      .set("x-csrf-token", csrf)
      .send({
        kind: "INSURANCE_RENEWAL",
        title: "Insurance",
        dueAt: "2026-01-15",
        rrule: "FREQ=YEARLY",
      });
    expect(created.status).toBe(201);
    const done = await owner
      .post(`/api/v1/orgs/${orgId}/compliance/${created.body.id}/complete`)
      .set("x-csrf-token", csrf);
    expect(done.status).toBe(201);
    expect(done.body.dueAt > "2026-01-15").toBe(true);
  });

  it("serves a personal calendar feed and a public sitemap on this host", async () => {
    const rotated = await owner.post("/api/v1/me/calendar-token/rotate").set("x-csrf-token", csrf);
    expect(rotated.status).toBe(200);
    const feedUrl = new URL(rotated.body.url as string);
    const feed = await request(app.getHttpServer()).get(feedUrl.pathname);
    expect(feed.status).toBe(200);
    expect(feed.headers["content-type"]).toContain("text/calendar");
    expect(feed.text).toContain("BEGIN:VCALENDAR");
    const sitemap = await request(app.getHttpServer()).get("/sitemap.xml");
    expect(sitemap.text).toContain("http://localhost:3000/");
    expect(sitemap.text).not.toContain("example.org");
    const home = await request(app.getHttpServer()).get("/");
    expect(home.status).toBe(200);
    expect(home.text.length).toBeLessThan(60_000);
    expect(home.text).not.toContain("<script");
  });

  it("confirms a digest subscriber before any send", async () => {
    const subscribed = await request(app.getHttpServer())
      .post("/api/v1/public/digest/subscribe")
      .send({ email: digestEmail, communities: ["Juneau"], focusAreas: ["Education & Youth"] });
    expect(subscribed.status).toBe(200);
    const mail = await request(app.getHttpServer())
      .get("/api/v1/test/mailbox")
      .query({ email: digestEmail });
    const text = (mail.body.messages as { text: string }[]).at(-1)?.text ?? "";
    const token = text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    const confirmed = await request(app.getHttpServer()).get(
      `/api/v1/public/digest/confirm?token=${token}`,
    );
    expect(confirmed.status).toBe(303);
    expect(confirmed.headers.location).toContain("/digest/confirmed");
  });

  it("lets an owner request an export and sign out", async () => {
    const exported = await owner.post(`/api/v1/orgs/${orgId}/export`).set("x-csrf-token", csrf);
    expect(exported.status).toBe(201);
    const queued = app.get(QueueService).memory.some((job) => job.name === "orgs:export");
    expect(queued).toBe(true);
    const dashboard = await owner.get(`/api/v1/orgs/${orgId}/dashboard`);
    expect(dashboard.status).toBe(200);
    expect(Array.isArray(dashboard.body.nextActions)).toBe(true);
    const loggedOut = await owner.post("/api/v1/auth/logout").set("x-csrf-token", csrf);
    expect(loggedOut.status).toBe(200);
    const me = await owner.get("/api/v1/me");
    expect(me.status).toBe(401);
    expect(orgSlug.length).toBeGreaterThan(0);
  });
});

async function latestCode(email: string): Promise<string> {
  const mail = await request(appHttp()).get("/api/v1/test/mailbox").query({ email });
  const text = (mail.body.messages as { text: string }[]).at(-1)?.text ?? "";
  const code = text.match(/(\d{6})/)?.[1];
  if (!code) throw new Error("missing sign-in code");
  return code;
}

let appHttp: () => ReturnType<INestApplication["getHttpServer"]>;

async function signIn(email: string): Promise<{ agent: request.Agent; csrf: string }> {
  const agent = request.agent(appHttp());
  const tokenResponse = await agent.get("/api/v1/auth/csrf");
  const token = tokenResponse.body.token as string;
  await agent.post("/api/v1/auth/login-request").set("x-csrf-token", token).send({ email });
  const code = await latestCode(email);
  const verified = await agent
    .post("/api/v1/auth/verify")
    .set("x-csrf-token", token)
    .send({ email, code });
  if (verified.status !== 200) {
    throw new Error(`sign-in failed ${verified.status} ${JSON.stringify(verified.body)}`);
  }
  return { agent, csrf: token };
}

function bindApp(application: INestApplication): void {
  appHttp = () => application.getHttpServer();
}

function headerText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(" ");
  return value ?? "";
}
