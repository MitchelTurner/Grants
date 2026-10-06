import { z } from "zod";

export const COVERAGE = ["STRONG", "PARTIAL", "MISSING"] as const;

export const CriteriaReview = z.object({
  items: z.array(
    z.object({
      criterion: z.string(),
      coverage: z.enum(COVERAGE),
      suggestion: z.string(),
    }),
  ),
});

export type CriteriaReview = z.infer<typeof CriteriaReview>;

export function coverageLabel(coverage: (typeof COVERAGE)[number]): string {
  if (coverage === "STRONG") return "Strong";
  if (coverage === "PARTIAL") return "Partial";
  return "Missing";
}
