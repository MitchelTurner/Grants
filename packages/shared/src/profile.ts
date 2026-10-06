import type { OrgType } from "./enums";

export type ProfileField = {
  field: string;
  label: string;
  reason: string;
};

export type ProfileCompleteness = {
  percent: number;
  complete: number;
  total: number;
  missing: ProfileField[];
};

export type ProfileInput = {
  type: OrgType;
  community: string;
  focusAreas: string[];
  mission: string | null;
  website: string | null;
  ein: string | null;
  uei: string | null;
  annualBudget: string | null;
  receivesFederalFunds: boolean;
  fiscalSponsorName: string | null;
};

const NONPROFIT_TYPES: OrgType[] = ["NONPROFIT_501C3", "FISCALLY_SPONSORED", "TRIBAL_ORGANIZATION"];

export function profileCompleteness(input: ProfileInput): ProfileCompleteness {
  const checks: { filled: boolean; field: ProfileField }[] = [
    {
      filled: input.community.trim().length > 0,
      field: {
        field: "community",
        label: "Community",
        reason: "Funders want to know where the work happens.",
      },
    },
    {
      filled: input.focusAreas.length > 0,
      field: {
        field: "focusAreas",
        label: "Focus areas",
        reason: "These match you to opportunities.",
      },
    },
    {
      filled: Boolean(input.mission && input.mission.trim().length > 0),
      field: {
        field: "mission",
        label: "Mission",
        reason: "Almost every application asks for this in plain language.",
      },
    },
    {
      filled: Boolean(input.website && input.website.trim().length > 0),
      field: {
        field: "website",
        label: "Website",
        reason: "Reviewers use it to confirm you are a real organization.",
      },
    },
    {
      filled: input.annualBudget != null && input.annualBudget !== "",
      field: {
        field: "annualBudget",
        label: "Annual budget",
        reason: "Many applications ask for last year's budget.",
      },
    },
  ];

  if (NONPROFIT_TYPES.includes(input.type)) {
    checks.push({
      filled: Boolean(input.ein && input.ein.trim().length > 0),
      field: {
        field: "ein",
        label: "EIN",
        reason:
          "Your employer identification number from the IRS. Funders use it to confirm nonprofit status.",
      },
    });
  }

  if (input.type === "FISCALLY_SPONSORED") {
    checks.push({
      filled: Boolean(input.fiscalSponsorName && input.fiscalSponsorName.trim().length > 0),
      field: {
        field: "fiscalSponsorName",
        label: "Fiscal sponsor",
        reason: "The 501(c)(3) that receives funds for you.",
      },
    });
  }

  if (input.receivesFederalFunds || input.type === "TRIBE" || input.type === "MUNICIPALITY") {
    checks.push({
      filled: Boolean(input.uei && input.uei.trim().length > 0),
      field: {
        field: "uei",
        label: "UEI",
        reason: "Your 12-character federal ID from SAM.gov. You only need this for federal grants.",
      },
    });
  }

  const missing = checks.filter((item) => !item.filled).map((item) => item.field);
  const complete = checks.length - missing.length;
  const percent = checks.length === 0 ? 100 : Math.round((complete / checks.length) * 100);
  return { percent, complete, total: checks.length, missing };
}

export const PACKET_KINDS = [
  "IRS_DETERMINATION_LETTER",
  "W9",
  "BOARD_LIST",
  "ORG_BUDGET",
  "FINANCIAL_STATEMENT",
  "INSURANCE_CERTIFICATE",
] as const;

export type PacketKind = (typeof PACKET_KINDS)[number];

/** Audited financials satisfy the "financials" packet slot. */
export function packetMissing(kindsPresent: string[]): PacketKind[] {
  return PACKET_KINDS.filter((kind) => {
    if (kindsPresent.includes(kind)) return false;
    if (kind === "FINANCIAL_STATEMENT" && kindsPresent.includes("AUDITED_FINANCIALS")) return false;
    return true;
  });
}
