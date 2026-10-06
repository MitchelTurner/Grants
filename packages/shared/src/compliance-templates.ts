import { RRule } from "rrule";
import type { ComplianceKind, OrgType } from "./enums";

export type ComplianceTemplate = {
  id: string;
  kind: ComplianceKind;
  title: string;
  explanation: string;
  officialUrl: string;
  rrule: string | null;
  /** YYYY-MM-DD when the date can be computed. Otherwise the user enters it. */
  suggestedDueAt: string | null;
};

export type TemplateContext = {
  orgType: OrgType;
  receivesFederalFunds: boolean;
  fiscalYearStartMonth: number;
  today: string;
};

const INSURANCE: ComplianceTemplate = {
  id: "insurance-renewal",
  kind: "INSURANCE_RENEWAL",
  title: "Insurance renewal",
  explanation:
    "Most funders ask for a current insurance certificate. Put the expiration date from the policy here so a renewal does not sneak up during a busy season.",
  officialUrl: "https://www.commerce.alaska.gov/web/ins/",
  rrule: "FREQ=YEARLY;INTERVAL=1",
  suggestedDueAt: null,
};

const BOARD: ComplianceTemplate = {
  id: "board-election",
  kind: "BOARD_ELECTION",
  title: "Board election",
  explanation:
    "If your bylaws set a board term, track the next election. Skip this if it does not apply to your organization.",
  officialUrl: "https://www.law.cornell.edu/uscode/text/26/501",
  rrule: "FREQ=YEARLY;INTERVAL=1",
  suggestedDueAt: null,
};

const ANNUAL: ComplianceTemplate = {
  id: "annual-meeting",
  kind: "ANNUAL_MEETING",
  title: "Annual meeting",
  explanation:
    "Many bylaws require a yearly meeting of the board or members. Enter the date your organization actually uses.",
  officialUrl: "https://www.commerce.alaska.gov/cbp/main/search/entities",
  rrule: "FREQ=YEARLY;INTERVAL=1",
  suggestedDueAt: null,
};

const FORM_990: Omit<ComplianceTemplate, "suggestedDueAt"> = {
  id: "irs-990",
  kind: "IRS_990",
  title: "IRS Form 990",
  explanation:
    "Tax-exempt organizations file a Form 990 each year. The usual due date is the 15th day of the 5th month after your fiscal year ends. You can change the date if you file an extension.",
  officialUrl: "https://www.irs.gov/forms-pubs/about-form-990",
  rrule: "FREQ=YEARLY;INTERVAL=1",
};

const BIENNIAL: ComplianceTemplate = {
  id: "alaska-biennial",
  kind: "ALASKA_BIENNIAL_REPORT",
  title: "Alaska biennial report",
  explanation:
    "Alaska corporations file a biennial report with the state. The due date depends on your entity record. Enter the date shown there.",
  officialUrl: "https://www.commerce.alaska.gov/cbp/main/search/entities",
  rrule: "FREQ=YEARLY;INTERVAL=2",
  suggestedDueAt: null,
};

const PICK: ComplianceTemplate = {
  id: "pick-click-give",
  kind: "PICK_CLICK_GIVE",
  title: "Pick.Click.Give application",
  explanation:
    "Pick.Click.Give lets Alaskans donate part of their Permanent Fund Dividend to your nonprofit. You apply every year. Enter the date for this year's application.",
  officialUrl: "https://www.pickclickgive.org/",
  rrule: "FREQ=YEARLY;INTERVAL=1",
  suggestedDueAt: null,
};

const SAM: ComplianceTemplate = {
  id: "sam-renewal",
  kind: "SAM_REGISTRATION",
  title: "SAM.gov registration renewal",
  explanation:
    "SAM.gov is the federal registration system. The Unique Entity ID lives there, and the registration expires every year. Enter the expiration date shown in SAM.gov. Renewal can take several weeks.",
  officialUrl: "https://sam.gov",
  rrule: "FREQ=YEARLY;INTERVAL=1",
  suggestedDueAt: null,
};

const LICENSE: ComplianceTemplate = {
  id: "business-license",
  kind: "BUSINESS_LICENSE",
  title: "Alaska business license renewal",
  explanation:
    "Alaska business licenses are renewed on a schedule tied to your license record. Enter the expiration date from your license.",
  officialUrl: "https://www.commerce.alaska.gov/web/cbpl/BusinessLicensing.aspx",
  rrule: "FREQ=YEARLY;INTERVAL=1",
  suggestedDueAt: null,
};

/** 15th day of the 5th month after fiscal year end, on or after `today`. */
export function nextForm990DueDate(fiscalYearStartMonth: number, today: string): string {
  const [yearText] = today.split("-");
  const startYear = Number(yearText);
  for (let year = startYear - 1; year <= startYear + 2; year += 1) {
    const due = form990DueInYear(fiscalYearStartMonth, year);
    if (due >= today) {
      return due;
    }
  }
  return form990DueInYear(fiscalYearStartMonth, startYear + 2);
}

function form990DueInYear(fiscalYearStartMonth: number, fiscalYearEndingYear: number): string {
  const endMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;
  const endYear = fiscalYearStartMonth === 1 ? fiscalYearEndingYear : fiscalYearEndingYear;
  const dueMonthIndex = endMonth - 1 + 5;
  const dueYear = endYear + Math.floor(dueMonthIndex / 12);
  const dueMonth = (dueMonthIndex % 12) + 1;
  return `${dueYear}-${String(dueMonth).padStart(2, "0")}-15`;
}

export function complianceTemplatesFor(context: TemplateContext): ComplianceTemplate[] {
  const templates: ComplianceTemplate[] = [INSURANCE, BOARD, ANNUAL];
  if (context.orgType === "NONPROFIT_501C3") {
    templates.push({
      ...FORM_990,
      suggestedDueAt: nextForm990DueDate(context.fiscalYearStartMonth, context.today),
    });
    templates.push(BIENNIAL, PICK);
  }
  if (
    context.receivesFederalFunds ||
    context.orgType === "TRIBE" ||
    context.orgType === "MUNICIPALITY"
  ) {
    templates.push(SAM);
  }
  if (context.orgType === "SMALL_BUSINESS") {
    templates.push(LICENSE);
  }
  return templates;
}

/** Next due date strictly after the current one, from an RFC 5545 rule. */
export function nextDueDate(rrule: string, currentDueAt: string): string | null {
  const start = dateOnlyUtc(currentDueAt);
  const source = rrule.startsWith("RRULE:") ? rrule.slice("RRULE:".length) : rrule;
  const options = RRule.parseString(source);
  const rule = new RRule({ ...options, dtstart: start });
  const next = rule.after(start, false);
  if (!next) {
    return null;
  }
  return next.toISOString().slice(0, 10);
}

function dateOnlyUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0));
}
