import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  AwardBody,
  BudgetLineBody,
  ExpenditureBody,
  InteractionBody,
  MatchEntryBody,
  MetricBody,
  MetricEntryBody,
  ReimbursementBody,
  ReportBody,
} from "@se-grants/shared";
import {
  AuthGuard,
  CsrfGuard,
  OrgMemberGuard,
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
import { AwardsService } from "../awards/awards.service";
import { BillingService } from "../billing/billing.service";

@Controller("orgs/:orgId/awards")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class AwardsController {
  constructor(private readonly awards: AwardsService) {}

  @Get()
  list(@CurrentOrg() org: RequestOrg) {
    return this.awards.list(org.organizationId);
  }

  @Post()
  @RequireRole("EDITOR")
  create(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Req() req: AppRequest,
  ) {
    return this.awards.create(
      org.organizationId,
      user.id,
      parseInput(AwardBody, body),
      clientIp(req),
    );
  }

  @Get("federal-spend")
  federalSpend(@CurrentOrg() org: RequestOrg) {
    return this.awards.federalSpend(org.organizationId);
  }

  @Get(":awardId")
  get(@CurrentOrg() org: RequestOrg, @Param("awardId") awardId: string) {
    return this.awards.get(org.organizationId, awardId);
  }

  @Post(":awardId/budget-lines")
  @RequireRole("EDITOR")
  addBudgetLine(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Body() body: unknown,
  ) {
    return this.awards.addBudgetLine(org.organizationId, awardId, parseInput(BudgetLineBody, body));
  }

  @Post(":awardId/expenditures")
  @RequireRole("EDITOR")
  addExpenditure(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Body() body: unknown,
  ) {
    return this.awards.addExpenditure(
      org.organizationId,
      awardId,
      parseInput(ExpenditureBody, body),
    );
  }

  @Post(":awardId/reimbursements")
  @RequireRole("EDITOR")
  addReimbursement(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Body() body: unknown,
  ) {
    return this.awards.addReimbursement(
      org.organizationId,
      awardId,
      parseInput(ReimbursementBody, body),
    );
  }

  @Post(":awardId/reports")
  @RequireRole("EDITOR")
  addReport(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Body() body: unknown,
  ) {
    return this.awards.addReport(org.organizationId, awardId, parseInput(ReportBody, body));
  }

  @Post(":awardId/reports/:reportId/generate")
  @RequireRole("EDITOR")
  generateReport(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("awardId") awardId: string,
    @Param("reportId") reportId: string,
  ) {
    return this.awards.generateReport(org.organizationId, user.id, awardId, reportId);
  }

  @Post(":awardId/reports/:reportId/submit")
  @RequireRole("EDITOR")
  @HttpCode(200)
  submitReport(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Param("reportId") reportId: string,
  ) {
    return this.awards.submitReport(org.organizationId, reportId, awardId);
  }

  @Post(":awardId/metrics")
  @RequireRole("EDITOR")
  addMetric(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Body() body: unknown,
  ) {
    return this.awards.addMetric(org.organizationId, awardId, parseInput(MetricBody, body));
  }

  @Post(":awardId/metrics/:metricId/entries")
  @RequireRole("EDITOR")
  addMetricEntry(
    @CurrentOrg() org: RequestOrg,
    @Param("awardId") awardId: string,
    @Param("metricId") metricId: string,
    @Body() body: unknown,
  ) {
    return this.awards.addMetricEntry(
      org.organizationId,
      awardId,
      metricId,
      parseInput(MetricEntryBody, body),
    );
  }
}

@Controller("orgs/:orgId/matches")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class MatchesController {
  constructor(private readonly awards: AwardsService) {}

  @Get()
  list(@CurrentOrg() org: RequestOrg) {
    return this.awards.listMatches(org.organizationId);
  }

  @Post()
  @RequireRole("CONTRIBUTOR")
  log(@CurrentOrg() org: RequestOrg, @CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.awards.logMatch(org.organizationId, user.id, parseInput(MatchEntryBody, body));
  }
}

@Controller("orgs/:orgId/interactions")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class InteractionsController {
  constructor(private readonly awards: AwardsService) {}

  @Get()
  list(@CurrentOrg() org: RequestOrg) {
    return this.awards.listInteractions(org.organizationId);
  }

  @Post()
  @RequireRole("EDITOR")
  add(@CurrentOrg() org: RequestOrg, @Body() body: unknown) {
    return this.awards.addInteraction(org.organizationId, parseInput(InteractionBody, body));
  }
}

@Controller("orgs/:orgId/billing")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
@RequireRole("ADMIN")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  view(@CurrentOrg() org: RequestOrg) {
    return this.billing.view(org.organizationId);
  }

  @Post("checkout")
  checkout(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Req() req: AppRequest,
  ) {
    return this.billing.checkout(org.organizationId, user.id, org.slug, clientIp(req));
  }

  @Post("portal")
  portal(@CurrentOrg() org: RequestOrg) {
    return this.billing.portal(org.organizationId, org.slug);
  }
}
