import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "../common/audit/audit.module";
import { AuthGuard, CsrfGuard, OrgMemberGuard, PlatformGuard } from "../common/auth/guards";
import { SessionService } from "../common/auth/session.service";
import { ENV, type Env } from "../common/config/env";
import { MailModule } from "../common/mail/mail.module";
import { SmsModule } from "../common/sms/sms.module";
import { StorageModule } from "../common/storage/storage.module";
import { ApplicationsService } from "./applications/applications.service";
import { AuthService } from "./auth/auth.service";
import { CalendarService } from "./calendar/calendar.service";
import { ComplianceService } from "./compliance/compliance.service";
import { ContentService } from "./content/content.service";
import { DashboardService } from "./dashboard/dashboard.service";
import { DigestService } from "./digest/digest.service";
import { DirectoryService } from "./directory/directory.service";
import { DocumentsService } from "./documents/documents.service";
import { ExportService } from "./export/export.service";
import {
  AdminController,
  DirectoryController,
  PublicDigestController,
  TestMailboxController,
  WebhooksController,
} from "./http/directory.controller";
import {
  AuthController,
  InvitationAcceptController,
  MeController,
  MembersController,
  OrgsController,
} from "./http/identity.controller";
import {
  ApplicationsController,
  CalendarDashboardController,
  ComplianceController,
  ComplianceTemplateController,
  ContentController,
  DocumentsController,
} from "./http/records.controller";
import { OrgsService } from "./orgs/orgs.service";
import { PublicSiteController } from "./public-site/public-site.controller";
import { PublicSiteService } from "./public-site/public-site.service";
import { RemindersService } from "./reminders/reminders.service";

@Module({
  imports: [
    AuditModule,
    MailModule,
    SmsModule,
    StorageModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        throttlers: [{ ttl: 60_000, limit: env.NODE_ENV === "test" ? 5_000 : 60 }],
      }),
    }),
  ],
  controllers: [
    AuthController,
    MeController,
    OrgsController,
    MembersController,
    InvitationAcceptController,
    DocumentsController,
    ContentController,
    ApplicationsController,
    ComplianceController,
    ComplianceTemplateController,
    CalendarDashboardController,
    DirectoryController,
    AdminController,
    PublicDigestController,
    WebhooksController,
    TestMailboxController,
    PublicSiteController,
  ],
  providers: [
    SessionService,
    AuthGuard,
    CsrfGuard,
    OrgMemberGuard,
    PlatformGuard,
    AuthService,
    OrgsService,
    DocumentsService,
    ContentService,
    ApplicationsService,
    ComplianceService,
    DirectoryService,
    RemindersService,
    DashboardService,
    CalendarService,
    DigestService,
    ExportService,
    PublicSiteService,
  ],
  exports: [
    AuthService,
    RemindersService,
    DigestService,
    DirectoryService,
    ExportService,
    DashboardService,
  ],
})
export class Phase1Module {}
