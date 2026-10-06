import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/bootstrap";
import { QueueService } from "../src/common/jobs/queue.service";
import { PrismaService } from "../src/common/prisma/prisma.service";

const stamp = `p2${Date.now().toString(36)}`;
const ownerEmail = `writer-${stamp}@example.org`;
const otherEmail = `outsider-${stamp}@example.org`;
const partnerEmail = `partner-${stamp}@example.org`;

describe("phase 2", () => {
  let app: INestApplication;
  let owner: request.Agent;
  let csrf = "";
  let orgId = "";
  let applicationId = "";
  let parseId = "";
  let checklistCount = 0;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    owner = request.agent(app.getHttpServer());
    const token = await owner.get("/api/v1/auth/csrf");
    csrf = token.body.token as string;
    await owner
      .post("/api/v1/auth/login-request")
      .set("x-csrf-token", csrf)
      .send({ email: ownerEmail });
    const code = await latestCode(app, ownerEmail);
    await owner
      .post("/api/v1/auth/verify")
      .set("x-csrf-token", csrf)
      .send({ email: ownerEmail, code });
    const org = await owner
      .post("/api/v1/orgs")
      .set("x-csrf-token", csrf)
      .send({
        name: `Writers ${stamp}`,
        type: "NONPROFIT_501C3",
        community: "Haines",
        focusAreas: ["Food Security & Subsistence"],
        receivesFederalFunds: false,
      });
    orgId = org.body.id as string;
    const application = await owner
      .post(`/api/v1/orgs/${orgId}/applications`)
      .set("x-csrf-token", csrf)
      .send({ title: "Unconfirmed application" });
    applicationId = application.body.id as string;
    checklistCount = (application.body.checklist as unknown[]).length;
  });

  afterAll(async () => {
    await app.get(PrismaService).db.platformSetting.upsert({
      where: { key: "AI_MONTHLY_TOKENS_FREE" },
      create: {
        key: "AI_MONTHLY_TOKENS_FREE",
        value: "100000",
        description: "Monthly token allowance for the free plan.",
      },
      update: { value: "100000" },
    });
    await app.close();
  });

  it("reads an RFP without saving a deadline or checklist item", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    const signed = await owner
      .post(`/api/v1/orgs/${orgId}/documents/upload-url`)
      .set("x-csrf-token", csrf)
      .send({ filename: "nofo.pdf", mimeType: "application/pdf", sizeBytes: pdf.length });
    expect(signed.status).toBe(201);
    const upload = new URL(signed.body.uploadUrl as string);
    await owner
      .put(`${upload.pathname}${upload.search}`)
      .set("content-type", "application/pdf")
      .send(pdf);
    const document = await owner
      .post(`/api/v1/orgs/${orgId}/documents`)
      .set("x-csrf-token", csrf)
      .send({
        storageKey: signed.body.storageKey,
        kind: "RFP_NOFO",
        title: "Sample NOFO",
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
      });
    const parsed = await owner
      .post(`/api/v1/orgs/${orgId}/documents/${document.body.id}/rfp-parses`)
      .set("x-csrf-token", csrf)
      .send({ applicationId });
    expect(parsed.status).toBe(201);
    expect(parsed.body.status).toBe("NEEDS_REVIEW");
    expect(parsed.body.extraction.programTitle).toBe("Harbor Safety Sample");
    expect(parsed.body.warnings.join(" ")).toContain("SAM.gov");
    expect(app.get(QueueService).memory.some((job) => job.name === "ai:rfp-parse")).toBe(true);
    parseId = parsed.body.id as string;
    const applied = await owner
      .post(`/api/v1/orgs/${orgId}/rfp-parses/${parseId}/apply`)
      .set("x-csrf-token", csrf)
      .send({
        applyTitle: false,
        title: "",
        applyDeadline: false,
        deadlineIso: "",
        sections: [
          {
            include: true,
            heading: "Need",
            prompt: "Describe the harbor safety problem in your community.",
            limit: "500 words",
          },
        ],
      });
    expect(applied.status).toBe(201);
    expect(applied.body.status).toBe("APPLIED");
    const application = await owner.get(`/api/v1/orgs/${orgId}/applications/${applicationId}`);
    expect(application.body.title).toBe("Unconfirmed application");
    expect(application.body.funderDeadlineAt).toBeNull();
    expect(application.body.checklist).toHaveLength(checklistCount);
    const sections = await owner.get(
      `/api/v1/orgs/${orgId}/applications/${applicationId}/sections`,
    );
    expect(sections.body[0].heading).toBe("Need");
    expect(sections.body[0].wordLimit).toBe(500);
    expect(sections.body[0].source).toBe("RFP_PARSER");
  });

  it("hides the reading from another organization", async () => {
    const outsider = await signIn(app, otherEmail);
    const org = await outsider.agent
      .post("/api/v1/orgs")
      .set("x-csrf-token", outsider.csrf)
      .send({
        name: `Other ${stamp}`,
        type: "NONPROFIT_501C3",
        community: "Sitka",
        focusAreas: ["Arts & Culture"],
        receivesFederalFunds: false,
      });
    const hidden = await outsider.agent.get(`/api/v1/orgs/${org.body.id}/rfp-parses/${parseId}`);
    expect(hidden.status).toBe(404);
  });

  it("streams a draft that marks missing facts and can review criteria", async () => {
    const sections = await owner.get(
      `/api/v1/orgs/${orgId}/applications/${applicationId}/sections`,
    );
    const sectionId = sections.body[0].id as string;
    const draft = await owner
      .post(`/api/v1/orgs/${orgId}/applications/${applicationId}/sections/${sectionId}/draft`)
      .set("x-csrf-token", csrf)
      .send({ contentBlockIds: [], dataPointIds: [], tone: "plain", targetWords: 120 });
    expect(draft.status).toBe(200);
    expect(draft.text).toContain("[NEEDS:");
    expect(draft.headers["content-type"]).toContain("text/event-stream");
    const review = await owner
      .post(`/api/v1/orgs/${orgId}/applications/${applicationId}/sections/${sectionId}/review`)
      .set("x-csrf-token", csrf)
      .send({ criteria: [{ criterion: "Community need", points: 40 }] });
    expect(review.status).toBe(201);
    expect(review.body.review.items[0].coverage).toBe("PARTIAL");
    expect(app.get(QueueService).memory.some((job) => job.name === "ai:report-draft")).toBe(true);
  });

  it("returns a friendly quota message", async () => {
    await app.get(PrismaService).db.platformSetting.upsert({
      where: { key: "AI_MONTHLY_TOKENS_FREE" },
      create: {
        key: "AI_MONTHLY_TOKENS_FREE",
        value: "1",
        description: "Monthly token allowance for the free plan.",
      },
      update: { value: "1" },
    });
    const sections = await owner.get(
      `/api/v1/orgs/${orgId}/applications/${applicationId}/sections`,
    );
    const blocked = await owner
      .post(
        `/api/v1/orgs/${orgId}/applications/${applicationId}/sections/${sections.body[0].id}/draft`,
      )
      .set("x-csrf-token", csrf)
      .send({ contentBlockIds: [], dataPointIds: [], tone: "plain", targetWords: 80 });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toContain("writing allowance");
    await app.get(PrismaService).db.platformSetting.update({
      where: { key: "AI_MONTHLY_TOKENS_FREE" },
      data: { value: "100000" },
    });
  });

  it("expires a packet link and keeps a password on the packet", async () => {
    const pdf = Buffer.from("%PDF-1.4 packet");
    const signed = await owner
      .post(`/api/v1/orgs/${orgId}/documents/upload-url`)
      .set("x-csrf-token", csrf)
      .send({ filename: "packet.pdf", mimeType: "application/pdf", sizeBytes: pdf.length });
    const upload = new URL(signed.body.uploadUrl as string);
    await owner
      .put(`${upload.pathname}${upload.search}`)
      .set("content-type", "application/pdf")
      .send(pdf);
    const document = await owner
      .post(`/api/v1/orgs/${orgId}/documents`)
      .set("x-csrf-token", csrf)
      .send({
        storageKey: signed.body.storageKey,
        kind: "BOARD_LIST",
        title: `Board list ${stamp}`,
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
      });
    const openShare = await owner
      .post(`/api/v1/orgs/${orgId}/packet-shares`)
      .set("x-csrf-token", csrf)
      .send({
        documentIds: [document.body.id],
        expiresInDays: 7,
        password: null,
      });
    expect(openShare.status).toBe(201);
    const openPage = await request(app.getHttpServer()).get(`/share/${openShare.body.token}`);
    expect(openPage.status).toBe(200);
    expect(openPage.text).toContain(`Board list ${stamp}`);
    await app.get(PrismaService).db.packetShare.update({
      where: { id: openShare.body.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await request(app.getHttpServer()).get(`/share/${openShare.body.token}`);
    expect(expired.status).toBe(410);

    const secret = await owner
      .post(`/api/v1/orgs/${orgId}/packet-shares`)
      .set("x-csrf-token", csrf)
      .send({
        documentIds: [document.body.id],
        expiresInDays: 7,
        password: "harbor-pass",
      });
    const locked = await request(app.getHttpServer()).get(`/share/${secret.body.token}`);
    expect(locked.status).toBe(200);
    expect(locked.text).not.toContain(`Board list ${stamp}`);
    const guest = request.agent(app.getHttpServer());
    const unlocked = await guest
      .post(`/share/${secret.body.token}/unlock`)
      .type("form")
      .send({ password: "harbor-pass" });
    expect(unlocked.status).toBe(303);
    const opened = await guest.get(`/share/${secret.body.token}`);
    expect(opened.text).toContain(`Board list ${stamp}`);
  });

  it("lets a partner view and decline a support letter", async () => {
    const created = await owner
      .post(`/api/v1/orgs/${orgId}/applications/${applicationId}/support-letters`)
      .set("x-csrf-token", csrf)
      .send({
        partnerName: "Ada Partner",
        partnerEmail,
        draftBody: `Please support ${stamp}.`,
        dueAt: null,
      });
    expect(created.status).toBe(201);
    const mail = await request(app.getHttpServer())
      .get("/api/v1/test/mailbox")
      .query({ email: partnerEmail });
    const text = (mail.body.messages as { text: string }[]).at(-1)?.text ?? "";
    const token = text.match(/\/support\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    const page = await request(app.getHttpServer()).get(`/support/${token}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain(`Please support ${stamp}.`);
    const declined = await request(app.getHttpServer()).post(`/support/${token}/decline`);
    expect(declined.status).toBe(200);
    expect(declined.text).toContain("declined");
  });

  it("shows published grants on the public quiz", async () => {
    const prisma = app.get(PrismaService).db;
    const funder = await prisma.funder.create({
      data: {
        name: `Quiz Funder ${stamp}`,
        slug: `quiz-funder-${stamp}`,
        type: "PRIVATE_FOUNDATION",
        isPublished: true,
        lastVerifiedAt: new Date(),
      },
    });
    await prisma.opportunity.create({
      data: {
        funderId: funder.id,
        title: `Quiz Grant ${stamp}`,
        slug: `quiz-grant-${stamp}`,
        summary: "A published sample for the quiz.",
        eligibleOrgTypes: ["NONPROFIT_501C3"],
        eligibleCommunities: ["Haines"],
        focusAreas: ["Food Security & Subsistence"],
        deadlineType: "ROLLING",
        status: "OPEN",
        isPublic: true,
        requiresSam: true,
      },
    });
    const form = await request(app.getHttpServer()).get("/quiz");
    expect(form.status).toBe(200);
    expect(form.text).toContain("Which grants might fit?");
    const result = await request(app.getHttpServer()).post("/quiz").type("form").send({
      orgType: "NONPROFIT_501C3",
      community: "Haines",
      focus: "Food Security & Subsistence",
      federal: "no",
    });
    expect(result.status).toBe(200);
    expect(result.text).toContain(`Quiz Grant ${stamp}`);
    expect(result.text).toContain("Good fit");
    expect(result.text).toContain("SAM.gov");
  });
});

async function latestCode(app: INestApplication, email: string): Promise<string> {
  const mail = await request(app.getHttpServer()).get("/api/v1/test/mailbox").query({ email });
  const text = (mail.body.messages as { text: string }[]).at(-1)?.text ?? "";
  const code = text.match(/(\d{6})/)?.[1];
  if (!code) throw new Error("missing sign-in code");
  return code;
}

async function signIn(app: INestApplication, email: string) {
  const agent = request.agent(app.getHttpServer());
  const tokenResponse = await agent.get("/api/v1/auth/csrf");
  const token = tokenResponse.body.token as string;
  await agent.post("/api/v1/auth/login-request").set("x-csrf-token", token).send({ email });
  const code = await latestCode(app, email);
  await agent.post("/api/v1/auth/verify").set("x-csrf-token", token).send({ email, code });
  return { agent, csrf: token };
}
