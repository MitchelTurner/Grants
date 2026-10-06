import type { CriteriaReview } from "./criteria";
import type { RfpExtraction } from "./rfp-extraction";

/** Deterministic extraction used when no Anthropic key is configured. */
export const SAMPLE_RFP_EXTRACTION: RfpExtraction = {
  programTitle: "Harbor Safety Sample",
  funderName: "Sample Foundation",
  plainSummary:
    "This sample program supports small harbor safety projects in Southeast Alaska. Awards are modest and the narrative is short.",
  deadlines: [
    {
      label: "Full application",
      asWritten: "March 12, 2027, 5:00 p.m. Alaska Time",
      isoDateTime: "2027-03-12T17:00:00.000Z",
      timezone: "America/Juneau",
      sourcePage: 2,
    },
  ],
  eligibility: [
    { requirement: "Nonprofit, tribe, or municipality in Southeast Alaska.", sourcePage: 3 },
  ],
  awardRange: { min: 5000, max: 25000, notes: "One year." },
  match: { required: false, description: "Match is not required.", sourcePage: 4 },
  registrationsRequired: ["SAM.gov"],
  requiredAttachments: [{ name: "Board list", notes: "Current year.", sourcePage: 5 }],
  narrativeSections: [
    {
      heading: "Need",
      prompt: "Describe the harbor safety problem in your community.",
      limit: "500 words",
      sourcePage: 6,
    },
  ],
  scoringCriteria: [
    { criterion: "Community need", points: 40, sourcePage: 7 },
    { criterion: "Feasible work plan", points: 30, sourcePage: 7 },
  ],
  submissionMethod: "Email the packet to grants@example.org.",
  formattingRules: ["Use 12-point type."],
  contacts: [{ name: "Sample Contact", email: "grants@example.org", phone: "" }],
  ambiguities: ["The match rule is unclear."],
};

export function sampleDraft(input: {
  orgName: string;
  community: string;
  mission: string;
  facts: string[];
}): string {
  const mission = input.mission.trim()
    ? input.mission.trim()
    : "[NEEDS: your mission in one sentence]";
  const fact = input.facts[0] ?? `[NEEDS: a current figure for ${input.community}]`;
  return `${input.orgName} serves ${input.community}. ${mission} The work described here uses only this fact: ${fact}`;
}

export function sampleReview(criteria: string[]): CriteriaReview {
  return {
    items: criteria.map((criterion) => ({
      criterion,
      coverage: "PARTIAL" as const,
      suggestion: `Add one concrete detail that answers "${criterion}".`,
    })),
  };
}
