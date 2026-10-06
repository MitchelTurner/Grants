export type FitLabel = "good_fit" | "possible_fit" | "not_eligible";

export type FitInput = {
  orgType: string;
  community: string;
  servesCommunities: string[];
  focusAreas: string[];
  eligibleOrgTypes: string[];
  eligibleCommunities: string[];
  focusAreasOnOpportunity: string[];
};

export type FitResult = {
  label: FitLabel;
  score: number;
  reasons: string[];
};

/**
 * Rules-based fit. SPEC §8 F6.
 * Not eligible when a non-empty restriction misses the org.
 * Score: +40 explicit org type (+20 unrestricted), +25 community (+15 unrestricted),
 * +10 per overlapping focus area (max +30). ≥70 is a good fit.
 */
export function scoreFit(input: FitInput): FitResult {
  const typeRestricted = input.eligibleOrgTypes.length > 0;
  const communityRestricted = input.eligibleCommunities.length > 0;
  const orgCommunities = [input.community, ...input.servesCommunities];

  if (typeRestricted && !input.eligibleOrgTypes.includes(input.orgType)) {
    return {
      label: "not_eligible",
      score: 0,
      reasons: ["Your organization type is not on this funder's list."],
    };
  }

  if (
    communityRestricted &&
    !input.eligibleCommunities.some((community) => orgCommunities.includes(community))
  ) {
    return {
      label: "not_eligible",
      score: 0,
      reasons: ["This opportunity does not cover your community."],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  if (typeRestricted) {
    score += 40;
    reasons.push("Your organization type is eligible.");
  } else {
    score += 20;
    reasons.push("Organization type is not restricted.");
  }

  if (communityRestricted) {
    score += 25;
    reasons.push("Your community is covered.");
  } else {
    score += 15;
    reasons.push("Location is not restricted.");
  }

  const overlap = input.focusAreas.filter((area) => input.focusAreasOnOpportunity.includes(area));
  const focusPoints = Math.min(30, overlap.length * 10);
  score += focusPoints;
  if (overlap.length > 0) {
    reasons.push(`Shared focus: ${overlap.join(", ")}.`);
  } else {
    reasons.push("No shared focus area.");
  }

  return {
    label: score >= 70 ? "good_fit" : "possible_fit",
    score,
    reasons,
  };
}

export function fitLabelText(label: FitLabel): string {
  if (label === "good_fit") return "Good fit";
  if (label === "possible_fit") return "Possible fit";
  return "Not eligible";
}
