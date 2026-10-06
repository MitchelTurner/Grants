import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/bootstrap";
import { signBillingBody } from "../src/common/billing/billing.provider";
import { ENV, type Env } from "../src/common/config/env";
import { PrismaService } from "../src/common/prisma/prisma.service";

const stamp = `p3${Date.now().toString(36)}`;
const ownerEmail = `treasurer-${stamp}@example.org`;
const otherEmail = `neighbor-${stamp}@example.org`;
const viewerEmail = `viewer-${stamp}@example.org`;

describe("phase 3", () => {
  let app: INestApplication;
  let owner: request.Agent;
  let csrf = "";
  let orgId = "";
  let awardId = "";
  let lineId = "";
  let spendId = "";
  const clientId = `match${stamp}`;

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
        name: `Treasurers ${stamp}`,
        type: "NONPROFIT_501C3",
        community: "Haines",
        focusAreas: ["Food Security & Subsistence"],
        receivesFederalFunds: true,
      });
    orgId = org.body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("sets up an award only after the application is awarded", async () => {
    const draft = await owner
      .post(`/api/v1/orgs/${orgId}/applications`)
      .set("x-csrf-token", csrf)
      .send({ title: "Still drafting" });
    const tooSoon = await owner
      .post(`/api/v1/orgs/${orgId}/awards`)
      .set("x-csrf-token", csrf)
      .send(awardBody(draft.body.id as string));
    expect(tooSoon.status).toBe(400);
    expect(tooSoon.body.error.message).toContain("Mark the application awarded");

    const application = await owner
      .post(`/api/v1/orgs/${orgId}/applications`)
      .set("x-csrf-token", csrf)
      .send({ title: "Harbor award" });
    const awarded = await owner
      .patch(`/api/v1/orgs/${orgId}/applications/${application.body.id}`)
      .set("x-csrf-token", csrf)
      .send({ status: "AWARDED", amountAwarded: "5000.00" });
    expect(awarded.status).toBe(200);

    const backwards = await owner
      .post(`/api/v1/orgs/${orgId}/awards`)
      .set("x-csrf-token", csrf)
      .send({ ...awardBody(application.body.id as string), endDate: "2026-01-01" });
    expect(backwards.status).toBe(400);

    const created = await owner
      .post(`/api/v1/orgs/${orgId}/awards`)
      .set("x-csrf-token", csrf)
      .send({ ...awardBody(application.body.id as string), isFederal: true });
    expect(created.status).toBe(201);
    awardId = created.body.id as string;
    expect(created.body.paymentType).toBe("REIMBURSEMENT");

    const again = await owner
      .post(`/api/v1/orgs/${orgId}/awards`)
      .set("x-csrf-token", csrf)
      .send(awardBody(application.body.id as string));
    expect(again.status).toBe(400);
  });

  it("tracks spending, a typed reimbursement, and the cash still out", async () => {
    const line = await owner
      .post(`/api/v1/orgs/${orgId}/awards/${awardId}/budget-lines`)
      .set("x-csrf-token", csrf)
      .send({
        category: "SUPPLIES",
        description: "Program supplies",
        budgeted: "800.00",
        isMatch: false,
      });
    expect(line.status).toBe(201);
    lineId = line.body.id as string;
    const spend = await owner
      .post(`/api/v1/orgs/${orgId}/awards/${awardId}/expenditures`)
      .set("x-csrf-token", csrf)
      .send({
        budgetLineId: lineId,
        date: "2026-10-06",
        amount: "40.00",
        vendor: "Harbor Store",
        description: "Gloves",
        receiptDocumentId: null,
      });
    expect(spend.status).toBe(201);
    spendId = spend.body.id as string;
    const before = await owner.get(`/api/v1/orgs/${orgId}/awards/${awardId}`);
    expect(before.body.forecast.notYetRequested).toBe("40.00");
    expect(before.body.forecast.note).toContain("receipts");

    const requestRow = await owner
      .post(`/api/v1/orgs/${orgId}/awards/${awardId}/reimbursements`)
      .set("x-csrf-token", csrf)
      .send({
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        amount: "10.00",
        status: "SUBMITTED",
        expectedPaidAt: "2026-11-15T17:00:00.000Z",
        expenditureIds: [spendId],
      });
    expect(requestRow.status).toBe(201);
    const after = await owner.get(`/api/v1/orgs/${orgId}/awards/${awardId}`);
    expect(after.body.reimbursements[0].amount).toBe("10");
    expect(after.body.forecast.notYetRequested).toBe("0.00");
    expect(after.body.forecast.awaiting[0].amount).toBe("10");

    const outsider = await signIn(app, otherEmail);
    const otherOrg = await outsider.agent
      .post("/api/v1/orgs")
      .set("x-csrf-token", outsider.csrf)
      .send({
        name: `Neighbors ${stamp}`,
        type: "NONPROFIT_501C3",
        community: "Sitka",
        focusAreas: ["Arts & Culture"],
        receivesFederalFunds: false,
      });
    const hidden = await outsider.agent.get(`/api/v1/orgs/${otherOrg.body.id}/awards/${awardId}`);
    expect(hidden.status).toBe(404);
  });

  it("keeps federal spending under the seeded threshold", async () => {
    const spend = await owner.get(`/api/v1/orgs/${orgId}/awards/federal-spend`);
    expect(spend.status).toBe(200);
    expect(spend.body.federalSpent).toBe("40.00");
    expect(spend.body.threshold).toBe("1000000");
    expect(spend.body.over).toBe(false);
  });

  it("writes a draft report without marking it submitted", async () => {
    const report = await owner
      .post(`/api/v1/orgs/${orgId}/awards/${awardId}/reports`)
      .set("x-csrf-token", csrf)
      .send({
        kind: "PROGRESS",
        dueAt: "2026-12-01T17:00:00.000Z",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
      });
    expect(report.status).toBe(201);
    const generated = await owner
      .post(`/api/v1/orgs/${orgId}/awards/${awardId}/reports/${report.body.id}/generate`)
      .set("x-csrf-token", csrf)
      .send({});
    expect(generated.status).toBe(201);
    const detail = await owner.get(`/api/v1/orgs/${orgId}/awards/${awardId}`);
    const row = (
      detail.body.reports as { id: string; status: string; generatedDocumentId: string | null }[]
    ).find((item) => item.id === report.body.id);
    expect(row?.status).toBe("OPEN");
    expect(row?.generatedDocumentId).toBe(generated.body.documentId);
    const documents = await owner.get(`/api/v1/orgs/${orgId}/documents`);
    const file = (documents.body.items as { id: string; kind: string }[]).find(
      (item) => item.id === generated.body.documentId,
    );
    expect(file?.kind).toBe("GRANT_REPORT");
  });

  it("logs a match once when the same client id is sent again", async () => {
    const body = {
      awardId,
      volunteerName: "Ada",
      date: "2026-10-06",
      hours: "2.00",
      inKindValue: null,
      rate: null,
      description: "Packed food boxes",
      photoDocumentIds: [],
      lat: null,
      lng: null,
      clientId,
    };
    const first = await owner
      .post(`/api/v1/orgs/${orgId}/matches`)
      .set("x-csrf-token", csrf)
      .send(body);
    expect(first.status).toBe(201);
    expect(first.body.duplicate).toBe(false);
    const second = await owner
      .post(`/api/v1/orgs/${orgId}/matches`)
      .set("x-csrf-token", csrf)
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.duplicate).toBe(true);

    const outsider = await signIn(app, `replay-${stamp}@example.org`);
    const otherOrg = await outsider.agent
      .post("/api/v1/orgs")
      .set("x-csrf-token", outsider.csrf)
      .send({
        name: `Replay ${stamp}`,
        type: "NONPROFIT_501C3",
        community: "Juneau",
        focusAreas: ["Arts & Culture"],
        receivesFederalFunds: false,
      });
    const stolen = await outsider.agent
      .post(`/api/v1/orgs/${otherOrg.body.id}/matches`)
      .set("x-csrf-token", outsider.csrf)
      .send(body);
    expect(stolen.status).toBe(404);

    const viewer = await signIn(app, viewerEmail);
    const user = await app.get(PrismaService).db.user.findUnique({ where: { email: viewerEmail } });
    await app.get(PrismaService).db.membership.create({
      data: { userId: user?.id ?? "", organizationId: orgId, role: "VIEWER" },
    });
    const denied = await viewer.agent
      .post(`/api/v1/orgs/${orgId}/matches`)
      .set("x-csrf-token", viewer.csrf)
      .send({ ...body, clientId: `viewer${stamp}` });
    expect(denied.status).toBe(403);
  });

  it("changes the plan only after a verified billing notice", async () => {
    const checkout = await owner
      .post(`/api/v1/orgs/${orgId}/billing/checkout`)
      .set("x-csrf-token", csrf)
      .send({});
    expect(checkout.status).toBe(201);
    expect(checkout.body.url).toContain("billing=return");
    const stillFree = await owner.get(`/api/v1/orgs/${orgId}/billing`);
    expect(stillFree.body.plan).toBe("FREE");

    const rejected = await postNotice(
      app,
      { type: "checkout.session.completed", data: { object: {} } },
      "nope",
    );
    expect(rejected.status).toBe(400);

    const paid = await postNotice(app, {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          metadata: { organizationId: orgId },
          customer: `cus_${stamp}`,
          subscription: `sub_${stamp}`,
        },
      },
    });
    expect(paid.status).toBe(200);
    const pro = await owner.get(`/api/v1/orgs/${orgId}/billing`);
    expect(pro.body.plan).toBe("PRO");

    const canceled = await postNotice(app, {
      type: "customer.subscription.deleted",
      data: { object: { id: `sub_${stamp}` } },
    });
    expect(canceled.status).toBe(200);
    const free = await owner.get(`/api/v1/orgs/${orgId}/billing`);
    expect(free.body.plan).toBe("FREE");

    await app.get(PrismaService).db.organization.update({
      where: { id: orgId },
      data: { plan: "SPONSORED", stripeSubscriptionId: null },
    });
    const ignored = await postNotice(app, {
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          metadata: { organizationId: orgId },
          subscription: `sub_sponsored_${stamp}`,
        },
      },
    });
    expect(ignored.status).toBe(200);
    const sponsored = await app
      .get(PrismaService)
      .db.organization.findUnique({ where: { id: orgId } });
    expect(sponsored?.plan).toBe("SPONSORED");
    const blocked = await owner
      .post(`/api/v1/orgs/${orgId}/billing/checkout`)
      .set("x-csrf-token", csrf)
      .send({});
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toContain("sponsored seat");
  });
});

function awardBody(applicationId: string) {
  return {
    applicationId,
    amount: "5000.00",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    paymentType: "REIMBURSEMENT",
    isFederal: false,
    assistanceListing: null,
    matchRequiredAmount: null,
    restrictions: null,
    agreementDocumentId: null,
  };
}

async function postNotice(app: INestApplication, payload: unknown, signature?: string) {
  const env = app.get<Env>(ENV);
  const secret = env.STRIPE_WEBHOOK_SECRET ?? env.CSRF_SECRET;
  const raw = JSON.stringify(payload);
  return request(app.getHttpServer())
    .post("/api/v1/webhooks/stripe")
    .set("stripe-signature", signature ?? signBillingBody(secret, raw))
    .set("content-type", "application/json")
    .send(raw);
}

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
