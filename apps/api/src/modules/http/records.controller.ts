import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  CalendarQuery,
  ChecklistItemBody,
  ComplianceTemplateQuery,
  CreateApplicationBody,
  CreateComplianceBody,
  CreateContentBlockBody,
  CreateDocumentBody,
  PaginationQuery,
  ReorderChecklistBody,
  UpdateApplicationBody,
  UpdateComplianceBody,
  UpdateContentBlockBody,
  UpdateDocumentBody,
  UploadUrlBody,
} from "@se-grants/shared";
import {
  AuthGuard,
  CsrfGuard,
  OrgMemberGuard,
  Public,
  RequireRole,
  clientIp,
} from "../../common/auth/guards";
import {
  CurrentOrg,
  CurrentUser,
  type AppRequest,
  type RequestOrg,
  type RequestUser,
} from "../../common/auth/request-context";
import { parseInput } from "../../common/http/parse";
import { ApplicationsService } from "../applications/applications.service";
import { CalendarService } from "../calendar/calendar.service";
import { ComplianceService } from "../compliance/compliance.service";
import { ContentService } from "../content/content.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { DocumentsService } from "../documents/documents.service";
import { ExportService } from "../export/export.service";
import { AuthService } from "../auth/auth.service";

@Controller("orgs/:orgId/documents")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("upload-url")
  @RequireRole("CONTRIBUTOR")
  @UseGuards(ThrottlerGuard)
  uploadUrl(@CurrentOrg() org: RequestOrg, @Body() body: unknown) {
    return this.documents.uploadUrl(org.organizationId, parseInput(UploadUrlBody, body));
  }

  @Post()
  @RequireRole("CONTRIBUTOR")
  create(@CurrentOrg() org: RequestOrg, @CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.documents.create(org.organizationId, user.id, parseInput(CreateDocumentBody, body));
  }

  @Get()
  list(@CurrentOrg() org: RequestOrg, @Query() query: unknown) {
    const page = parseInput(PaginationQuery, query);
    return this.documents.list(org.organizationId, page.cursor, page.limit);
  }

  @Patch(":id")
  @RequireRole("EDITOR")
  update(@CurrentOrg() org: RequestOrg, @Param("id") id: string, @Body() body: unknown) {
    return this.documents.update(org.organizationId, id, parseInput(UpdateDocumentBody, body));
  }

  @Delete(":id")
  @RequireRole("EDITOR")
  @HttpCode(200)
  async remove(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    await this.documents.remove(org.organizationId, id);
    return { ok: true };
  }

  @Get(":id/download-url")
  download(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Req() req: AppRequest,
  ) {
    return this.documents.downloadUrl(org.organizationId, id, user.id, clientIp(req));
  }
}

@Controller("orgs/:orgId/content-blocks")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@CurrentOrg() org: RequestOrg, @Query() query: unknown) {
    const page = parseInput(PaginationQuery, query);
    return this.content.list(org.organizationId, page.cursor, page.limit);
  }

  @Post()
  @RequireRole("EDITOR")
  create(@CurrentOrg() org: RequestOrg, @CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.content.create(
      org.organizationId,
      user.id,
      parseInput(CreateContentBlockBody, body),
    );
  }

  @Get(":id")
  get(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.content.get(org.organizationId, id);
  }

  @Patch(":id")
  @RequireRole("EDITOR")
  update(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.content.update(
      org.organizationId,
      id,
      user.id,
      parseInput(UpdateContentBlockBody, body),
    );
  }

  @Delete(":id")
  @RequireRole("EDITOR")
  @HttpCode(200)
  async remove(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    await this.content.remove(org.organizationId, id);
    return { ok: true };
  }

  @Get(":id/versions")
  versions(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.content.versions(org.organizationId, id);
  }

  @Post(":id/restore/:version")
  @RequireRole("EDITOR")
  restore(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("version") version: string,
  ) {
    return this.content.restore(org.organizationId, id, Number(version), user.id);
  }
}

@Controller("orgs/:orgId/applications")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentOrg() org: RequestOrg, @Query() query: unknown) {
    const page = parseInput(PaginationQuery, query);
    return this.applications.list(org.organizationId, page.cursor, page.limit);
  }

  @Post()
  @RequireRole("EDITOR")
  create(@CurrentOrg() org: RequestOrg, @Body() body: unknown) {
    return this.applications.create(org.organizationId, parseInput(CreateApplicationBody, body));
  }

  @Post("from-opportunity/:opportunityId")
  @RequireRole("EDITOR")
  fromOpportunity(@CurrentOrg() org: RequestOrg, @Param("opportunityId") opportunityId: string) {
    return this.applications.fromOpportunity(org.organizationId, opportunityId);
  }

  @Get(":id")
  get(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.applications.get(org.organizationId, id);
  }

  @Patch(":id")
  @RequireRole("EDITOR")
  update(@CurrentOrg() org: RequestOrg, @Param("id") id: string, @Body() body: unknown) {
    return this.applications.update(
      org.organizationId,
      id,
      parseInput(UpdateApplicationBody, body),
    );
  }

  @Delete(":id")
  @RequireRole("EDITOR")
  @HttpCode(200)
  async remove(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    await this.applications.remove(org.organizationId, id);
    return { ok: true };
  }

  @Post(":id/checklist")
  @RequireRole("EDITOR")
  addItem(@CurrentOrg() org: RequestOrg, @Param("id") id: string, @Body() body: unknown) {
    return this.applications.addChecklist(
      org.organizationId,
      id,
      parseInput(ChecklistItemBody, body),
    );
  }

  @Patch(":id/checklist/:itemId")
  @RequireRole("CONTRIBUTOR")
  updateItem(
    @CurrentOrg() org: RequestOrg,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    return this.applications.updateChecklist(
      org.organizationId,
      id,
      itemId,
      parseInput(ChecklistItemBody.partial(), body),
    );
  }

  @Delete(":id/checklist/:itemId")
  @RequireRole("EDITOR")
  @HttpCode(200)
  async removeItem(
    @CurrentOrg() org: RequestOrg,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    await this.applications.removeChecklist(org.organizationId, id, itemId);
    return { ok: true };
  }

  @Post(":id/checklist/reorder")
  @RequireRole("EDITOR")
  reorder(@CurrentOrg() org: RequestOrg, @Param("id") id: string, @Body() body: unknown) {
    const input = parseInput(ReorderChecklistBody, body);
    return this.applications.reorder(org.organizationId, id, input.ids);
  }
}

@Controller("orgs/:orgId/compliance")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get()
  list(@CurrentOrg() org: RequestOrg) {
    return this.compliance.list(org.organizationId);
  }

  @Post()
  @RequireRole("EDITOR")
  create(@CurrentOrg() org: RequestOrg, @Body() body: unknown) {
    return this.compliance.create(org.organizationId, parseInput(CreateComplianceBody, body));
  }

  @Patch(":id")
  @RequireRole("EDITOR")
  update(@CurrentOrg() org: RequestOrg, @Param("id") id: string, @Body() body: unknown) {
    return this.compliance.update(org.organizationId, id, parseInput(UpdateComplianceBody, body));
  }

  @Delete(":id")
  @RequireRole("EDITOR")
  @HttpCode(200)
  async remove(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    await this.compliance.remove(org.organizationId, id);
    return { ok: true };
  }

  @Post(":id/complete")
  @RequireRole("EDITOR")
  complete(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.compliance.complete(org.organizationId, id);
  }
}

@Controller("compliance")
@UseGuards(AuthGuard, CsrfGuard)
export class ComplianceTemplateController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get("templates")
  templates(@Query() query: unknown) {
    const input = parseInput(ComplianceTemplateQuery, query);
    return this.compliance.templates(input);
  }
}

@Controller()
@UseGuards(AuthGuard, CsrfGuard)
export class CalendarDashboardController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly dashboard: DashboardService,
    private readonly auth: AuthService,
    private readonly exports: ExportService,
  ) {}

  @Get("orgs/:orgId/calendar")
  @UseGuards(OrgMemberGuard)
  calendarForOrg(@CurrentOrg() org: RequestOrg, @Query() query: unknown) {
    const input = parseInput(CalendarQuery, query);
    return this.calendar.forOrg(org.organizationId, new Date(input.from), new Date(input.to));
  }

  @Public()
  @Get("calendar/feed/:token")
  @Header("content-type", "text/calendar; charset=utf-8")
  async feed(@Param("token") token: string) {
    const raw = token.endsWith(".ics") ? token.slice(0, -4) : token;
    const userId = await this.auth.userIdForCalendarToken(raw);
    if (!userId) {
      return "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
    }
    return this.calendar.feedForUser(userId);
  }

  @Get("orgs/:orgId/dashboard")
  @UseGuards(OrgMemberGuard)
  dashboardForOrg(@CurrentOrg() org: RequestOrg) {
    return this.dashboard.get(org.organizationId);
  }

  @Post("orgs/:orgId/export")
  @UseGuards(OrgMemberGuard)
  @RequireRole("OWNER")
  exportOrg(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Req() req: AppRequest,
  ) {
    return this.exports.request(org.organizationId, user.id, clientIp(req));
  }
}
