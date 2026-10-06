import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  ApplyRfpBody,
  DataPointBody,
  DraftSectionBody,
  FOCUS_AREAS,
  ORG_TYPES,
  PacketShareBody,
  PastAwardBody,
  QuizBody,
  ReviewSectionBody,
  SectionBody,
  StartRfpParseBody,
  SupportLetterBody,
  UpdateSectionBody,
  orgTypeLabel,
} from "@se-grants/shared";
import type { Request, Response } from "express";
import {
  AuthGuard,
  CsrfGuard,
  OrgMemberGuard,
  PlatformGuard,
  RequirePlatform,
  RequireRole,
  sessionCookieOptions,
} from "../../common/auth/guards";
import {
  CurrentOrg,
  CurrentUser,
  type RequestOrg,
  type RequestUser,
} from "../../common/auth/request-context";
import { ENV, type Env } from "../../common/config/env";
import { safeEqual, signValue } from "../../common/crypto";
import { readCookie } from "../../common/http/cookies";
import { parseInput } from "../../common/http/parse";
import { Inject } from "@nestjs/common";
import { WriteService } from "../ai/write.service";
import { PublicSiteService } from "../public-site/public-site.service";

type UploadFile = { originalname: string; mimetype: string; buffer: Buffer };

@Controller("orgs/:orgId")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class WriteController {
  constructor(private readonly write: WriteService) {}

  @Get("applications/:id/rfp-parses")
  parses(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.write.listParses(org.organizationId, id);
  }

  @Get("applications/:id/sections")
  sections(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.write.listSections(org.organizationId, id);
  }

  @Post("applications/:id/sections")
  @RequireRole("EDITOR")
  createSection(@CurrentOrg() org: RequestOrg, @Param("id") id: string, @Body() body: unknown) {
    return this.write.createSection(org.organizationId, id, parseInput(SectionBody, body));
  }

  @Patch("applications/:id/sections/:sectionId")
  @RequireRole("EDITOR")
  updateSection(
    @CurrentOrg() org: RequestOrg,
    @Param("id") id: string,
    @Param("sectionId") sectionId: string,
    @Body() body: unknown,
  ) {
    return this.write.updateSection(
      org.organizationId,
      id,
      sectionId,
      parseInput(UpdateSectionBody, body),
    );
  }

  @Delete("applications/:id/sections/:sectionId")
  @RequireRole("EDITOR")
  @HttpCode(200)
  async removeSection(
    @CurrentOrg() org: RequestOrg,
    @Param("id") id: string,
    @Param("sectionId") sectionId: string,
  ) {
    await this.write.removeSection(org.organizationId, id, sectionId);
    return { ok: true };
  }

  @Post("applications/:id/sections/:sectionId/draft")
  @RequireRole("EDITOR")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async draft(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("sectionId") sectionId: string,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const input = parseInput(DraftSectionBody, body);
    let started = false;
    try {
      for await (const event of this.write.draft(
        org.organizationId,
        user.id,
        id,
        sectionId,
        input,
      )) {
        if (!started) {
          res.status(200);
          res.setHeader("content-type", "text/event-stream; charset=utf-8");
          res.setHeader("cache-control", "no-cache");
          res.flushHeaders();
          started = true;
        }
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    } catch (error) {
      if (!started) throw error;
      const message = error instanceof Error ? error.message : "The draft stopped.";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }

  @Post("applications/:id/sections/:sectionId/review")
  @RequireRole("EDITOR")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  review(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("sectionId") sectionId: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(ReviewSectionBody, body);
    return this.write.review(org.organizationId, user.id, id, sectionId, input.criteria);
  }

  @Get("reviews/:jobId")
  reviewStatus(@CurrentOrg() org: RequestOrg, @Param("jobId") jobId: string) {
    return this.write.getReview(org.organizationId, jobId);
  }

  @Post("documents/:documentId/rfp-parses")
  @RequireRole("EDITOR")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startParse(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("documentId") documentId: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(StartRfpParseBody, body);
    return this.write.startParse(org.organizationId, user.id, documentId, input.applicationId);
  }

  @Get("rfp-parses/:parseId")
  parse(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("parseId") parseId: string,
    @Req() req: Request,
  ) {
    return this.write.getParse(org.organizationId, user.id, parseId, req.ip);
  }

  @Post("rfp-parses/:parseId/apply")
  @RequireRole("EDITOR")
  apply(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("parseId") parseId: string,
    @Body() body: unknown,
  ) {
    return this.write.applyParse(
      org.organizationId,
      user.id,
      parseId,
      parseInput(ApplyRfpBody, body),
    );
  }

  @Get("data-points")
  dataPoints(@CurrentOrg() org: RequestOrg) {
    return this.write.listDataPoints(org.organizationId);
  }

  @Get("applications/:id/support-letters")
  letters(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.write.listSupportLetters(org.organizationId, id);
  }

  @Post("applications/:id/support-letters")
  @RequireRole("EDITOR")
  requestLetter(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.write.createSupportLetter(
      org.organizationId,
      user.id,
      id,
      parseInput(SupportLetterBody, body),
    );
  }

  @Post("packet-shares")
  @RequireRole("EDITOR")
  share(@CurrentOrg() org: RequestOrg, @CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.write.createPacketShare(
      org.organizationId,
      user.id,
      parseInput(PacketShareBody, body),
    );
  }
}

@Controller()
@UseGuards(AuthGuard, CsrfGuard)
export class PastAwardReadController {
  constructor(private readonly write: WriteService) {}

  @Get("funders/:id/past-awards")
  awards(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    const curator = user.platformRole === "CURATOR" || user.platformRole === "SUPERADMIN";
    return this.write.listPastAwards(id, curator);
  }
}

@Controller("admin")
@UseGuards(AuthGuard, CsrfGuard, PlatformGuard)
@RequirePlatform("CURATOR")
export class WriteAdminController {
  constructor(private readonly write: WriteService) {}

  @Post("data-points")
  createPoint(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.write.createDataPoint(user.id, parseInput(DataPointBody, body));
  }

  @Delete("data-points/:id")
  @HttpCode(200)
  async removePoint(@Param("id") id: string) {
    await this.write.removeDataPoint(id);
    return { ok: true };
  }

  @Post("past-awards")
  createAward(@Body() body: unknown) {
    return this.write.createPastAward(parseInput(PastAwardBody, body));
  }

  @Delete("past-awards/:id")
  @HttpCode(200)
  async removeAward(@Param("id") id: string) {
    await this.write.removePastAward(id);
    return { ok: true };
  }
}

@Controller()
export class PublicWriteController {
  constructor(
    private readonly write: WriteService,
    private readonly site: PublicSiteService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get("quiz")
  quizForm(@Res() res: Response) {
    res
      .type("html")
      .send(
        this.site.page(
          "Eligibility quiz · Southeast Grants",
          "See which published grants may fit.",
          quizFormHtml(),
        ),
      );
  }

  @Post("quiz")
  async quizSubmit(@Body() body: unknown, @Res() res: Response) {
    const parsed = QuizBody.safeParse(body);
    if (!parsed.success) {
      res
        .status(422)
        .type("html")
        .send(
          this.site.page(
            "Eligibility quiz · Southeast Grants",
            "See which published grants may fit.",
            quizFormHtml("Choose an organization type, community, and focus area."),
          ),
        );
      return;
    }
    const matches = await this.write.quiz(parsed.data);
    const items = matches
      .map(
        (match) =>
          `<li><a href="/grants/${escapeHtml(match.slug)}">${escapeHtml(match.title)}</a> — ${escapeHtml(match.funder)}<br />${escapeHtml(match.fit)}. ${escapeHtml(match.reasons.join(" "))} Deadline: ${escapeHtml(match.deadline)}. ${escapeHtml(match.federalNote)}</li>`,
      )
      .join("");
    res
      .status(200)
      .type("html")
      .send(
        this.site.page(
          "Quiz results · Southeast Grants",
          "Published grants that may fit.",
          `<h1>Possible matches</h1><p>These are published records only. Check each deadline on the funder's site.</p><ul>${items || "<li>No published grant matched those answers.</li>"}</ul><p><a href="/quiz">Try different answers</a></p>`,
        ),
      );
  }

  @Get("support/:token")
  async support(@Param("token") token: string, @Res() res: Response) {
    try {
      const letter = await this.write.supportLetterPage(token);
      res
        .type("html")
        .send(
          this.site.page(
            "Letter of support · Southeast Grants",
            "Review a requested letter.",
            `<h1>Letter for ${escapeHtml(letter.partnerName)}</h1><p>Status: ${escapeHtml(letter.status)}</p><pre>${escapeHtml(letter.draftBody)}</pre>${
              letter.status === "UPLOADED" || letter.status === "DECLINED"
                ? "<p>This request is finished.</p>"
                : `<form method="post" action="/support/${escapeHtml(token)}/upload" enctype="multipart/form-data"><label>Signed letter (PDF, PNG, or JPEG) <input type="file" name="file" required /></label><p><button type="submit">Upload</button></p></form><form method="post" action="/support/${escapeHtml(token)}/decline"><p><button type="submit">Decline</button></p></form>`
            }`,
          ),
        );
    } catch {
      res
        .status(404)
        .type("html")
        .send(
          this.site.page(
            "Not found · Southeast Grants",
            "That letter request is not available.",
            "<h1>Not found</h1>",
          ),
        );
    }
  }

  @Post("support/:token/decline")
  async decline(@Param("token") token: string, @Res() res: Response) {
    try {
      await this.write.declineSupportLetter(token);
      res
        .status(200)
        .type("html")
        .send(
          this.site.page(
            "Declined · Southeast Grants",
            "The letter request was declined.",
            "<h1>You declined this request</h1><p>No file was uploaded.</p>",
          ),
        );
    } catch {
      res
        .status(400)
        .type("html")
        .send(
          this.site.page(
            "Letter of support · Southeast Grants",
            "That request is finished.",
            "<h1>This request is already finished.</h1>",
          ),
        );
    }
  }

  @Post("support/:token/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @Param("token") token: string,
    @UploadedFile() file: UploadFile | undefined,
    @Res() res: Response,
  ) {
    if (!file) {
      res
        .status(400)
        .type("html")
        .send(
          this.site.page(
            "Letter of support · Southeast Grants",
            "Choose a file.",
            "<h1>Choose a file to upload.</h1>",
          ),
        );
      return;
    }
    try {
      await this.write.uploadSupportLetter(token, file);
      res
        .status(200)
        .type("html")
        .send(
          this.site.page(
            "Letter received · Southeast Grants",
            "The signed letter was saved.",
            "<h1>Letter received</h1><p>The organization can download it from their vault.</p>",
          ),
        );
    } catch {
      res
        .status(400)
        .type("html")
        .send(
          this.site.page(
            "Letter of support · Southeast Grants",
            "The upload did not finish.",
            "<h1>The upload did not finish.</h1><p>Use a PDF, PNG, or JPEG, and make sure the request is still open.</p>",
          ),
        );
    }
  }

  @Get("share/:token")
  async share(@Param("token") token: string, @Req() req: Request, @Res() res: Response) {
    try {
      const page = await this.write.packetSharePage(
        token,
        shareUnlocked(req, token, this.env.CSRF_SECRET),
      );
      if (page.expired) {
        res
          .status(410)
          .type("html")
          .send(
            this.site.page(
              "Link expired · Southeast Grants",
              "This share link has expired.",
              "<h1>This link has expired</h1>",
            ),
          );
        return;
      }
      if (page.locked) {
        res
          .type("html")
          .send(
            this.site.page(
              "Shared packet · Southeast Grants",
              "Enter the password to open this packet.",
              `<h1>This packet has a password</h1><form method="post" action="/share/${escapeHtml(token)}/unlock"><label>Password <input type="password" name="password" required minlength="8" /></label><p><button type="submit">Open</button></p></form>`,
            ),
          );
        return;
      }
      const files = page.files
        .map((file) => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(file.title)}</a></li>`)
        .join("");
      res
        .type("html")
        .send(
          this.site.page(
            "Shared packet · Southeast Grants",
            "Documents shared for a grant application.",
            `<h1>Shared documents</h1><ul>${files || "<li>None of these files are still available.</li>"}</ul><p class="muted">Download links expire in a few minutes.</p>`,
          ),
        );
    } catch {
      res
        .status(404)
        .type("html")
        .send(
          this.site.page(
            "Not found · Southeast Grants",
            "That share link is not available.",
            "<h1>Not found</h1>",
          ),
        );
    }
  }

  @Post("share/:token/unlock")
  async unlock(
    @Param("token") token: string,
    @Body() body: { password?: string },
    @Res() res: Response,
  ) {
    const password = typeof body.password === "string" ? body.password : "";
    const ok = await this.write.unlockPacketShare(token, password).catch(() => false);
    if (!ok) {
      res
        .status(401)
        .type("html")
        .send(
          this.site.page(
            "Shared packet · Southeast Grants",
            "That password did not match.",
            `<h1>That password did not match</h1><form method="post" action="/share/${escapeHtml(token)}/unlock"><label>Password <input type="password" name="password" required /></label><p><button type="submit">Open</button></p></form>`,
          ),
        );
      return;
    }
    const secure = sessionCookieOptions(this.env).secure;
    res.cookie("se_share", `${token}.${signValue(this.env.CSRF_SECRET, token)}`, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: `/share/${token}`,
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.redirect(303, `/share/${token}`);
  }
}

function shareUnlocked(req: Request, token: string, secret: string): boolean {
  const raw = readCookie(req, "se_share");
  if (!raw) return false;
  const split = raw.lastIndexOf(".");
  if (split <= 0) return false;
  const value = raw.slice(0, split);
  const signature = raw.slice(split + 1);
  return value === token && safeEqual(signature, signValue(secret, token));
}

function quizFormHtml(error?: string): string {
  const types = ORG_TYPES.map(
    (type) => `<option value="${type}">${escapeHtml(orgTypeLabel(type))}</option>`,
  ).join("");
  const focuses = FOCUS_AREAS.map(
    (focus) => `<option value="${escapeHtml(focus)}">${escapeHtml(focus)}</option>`,
  ).join("");
  return `<h1>Which grants might fit?</h1><p>This uses published opportunities only. It does not save your answers.</p>${
    error ? `<p>${escapeHtml(error)}</p>` : ""
  }<form method="post" action="/quiz"><label>Organization type <select name="orgType" required>${types}</select></label><label>Community <input name="community" required placeholder="Haines" /></label><label>Focus <select name="focus" required>${focuses}</select></label><fieldset><legend>Do you already receive federal funds?</legend><label><input type="radio" name="federal" value="yes" required /> Yes</label><label><input type="radio" name="federal" value="no" /> No</label></fieldset><p><button type="submit">Show matches</button></p></form>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
