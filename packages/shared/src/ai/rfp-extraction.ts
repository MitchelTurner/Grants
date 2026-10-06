import { z } from "zod";

export const RfpExtraction = z.object({
  programTitle: z.string(),
  funderName: z.string(),
  plainSummary: z.string(), // 2–3 sentences, plain language
  deadlines: z.array(
    z.object({
      label: z.string(), // "Full application", "Letter of intent", "Q&A webinar"
      asWritten: z.string(), // exactly as stated in the document
      isoDateTime: z.string().nullable(), // ISO 8601 if determinable, else null
      timezone: z.string().nullable(), // IANA name if stated, else null
      sourcePage: z.number().int(),
    }),
  ),
  eligibility: z.array(z.object({ requirement: z.string(), sourcePage: z.number().int() })),
  awardRange: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    notes: z.string(),
  }),
  match: z.object({ required: z.boolean(), description: z.string(), sourcePage: z.number().int() }),
  registrationsRequired: z.array(z.string()), // e.g. "SAM.gov", "Grants.gov"
  requiredAttachments: z.array(
    z.object({ name: z.string(), notes: z.string(), sourcePage: z.number().int() }),
  ),
  narrativeSections: z.array(
    z.object({
      heading: z.string(),
      prompt: z.string(),
      limit: z.string(),
      sourcePage: z.number().int(),
    }),
  ),
  scoringCriteria: z.array(
    z.object({
      criterion: z.string(),
      points: z.number().nullable(),
      sourcePage: z.number().int(),
    }),
  ),
  submissionMethod: z.string(),
  formattingRules: z.array(z.string()),
  contacts: z.array(z.object({ name: z.string(), email: z.string(), phone: z.string() })),
  ambiguities: z.array(z.string()), // anything unclear or contradictory, for the user to check
});

export type RfpExtraction = z.infer<typeof RfpExtraction>;
