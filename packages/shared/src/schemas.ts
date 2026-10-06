import { z } from "zod";
import { FOCUS_AREAS } from "./communities";
import {
  ApplicationStatusSchema,
  ChecklistKindSchema,
  ComplianceKindSchema,
  ContentCategorySchema,
  DeadlineTypeSchema,
  DocumentKindSchema,
  FunderTypeSchema,
  FundingFormSchema,
  MemberRoleSchema,
  OpportunityStatusSchema,
  OrgTypeSchema,
} from "./enums";

const email = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

export const MoneyString = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FocusAreaSchema = z.enum(FOCUS_AREAS);

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/heic",
  "text/plain",
  "text/csv",
] as const;

export const MimeTypeSchema = z.enum(ALLOWED_MIME);
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const LoginRequestBody = z.object({ email });
export const VerifyCodeBody = z.object({
  email,
  code: z.string().regex(/^\d{6}$/),
});

export const UpdateMeBody = z.object({
  name: z.string().trim().min(1).max(120).nullable().optional(),
  timezone: z.string().min(1).optional(),
  lastActiveOrgId: z.string().nullable().optional(),
});

export const PhoneStartBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});
export const PhoneVerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const NotificationPreferenceBody = z
  .object({
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
    weeklyDigest: z.boolean(),
    digestWeekday: z.number().int().min(0).max(6),
    digestHour: z.number().int().min(0).max(23),
    reminderOffsets: z.array(z.number().int().min(0).max(365)).min(1).max(12),
    quietStartHour: z.number().int().min(0).max(23),
    quietEndHour: z.number().int().min(0).max(23),
  })
  .partial();

export const CreateOrgBody = z.object({
  name: z.string().trim().min(2).max(160),
  type: OrgTypeSchema,
  community: z.string().trim().min(1).max(120),
  focusAreas: z.array(FocusAreaSchema).min(1),
  receivesFederalFunds: z.boolean(),
  servesCommunities: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  ein: z.string().trim().max(20).optional(),
  uei: z.string().trim().length(12).optional(),
  annualBudget: MoneyString.optional(),
});

export const UpdateOrgBody = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  type: OrgTypeSchema.optional(),
  community: z.string().trim().min(1).max(120).optional(),
  servesCommunities: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  ein: z.string().trim().max(20).nullable().optional(),
  uei: z.string().trim().length(12).nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  mission: z.string().max(8000).nullable().optional(),
  annualBudget: MoneyString.nullable().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  focusAreas: z.array(FocusAreaSchema).min(1).optional(),
  receivesFederalFunds: z.boolean().optional(),
  fiscalSponsorName: z.string().trim().max(200).nullable().optional(),
  timezone: z.string().min(1).optional(),
});

export const DeleteOrgBody = z.object({
  confirmName: z.string().min(1),
});

export const UpdateMemberBody = z.object({
  role: MemberRoleSchema.optional(),
  remindersMuted: z.boolean().optional(),
});

export const CreateInvitationBody = z.object({
  email,
  role: MemberRoleSchema,
});

export const AcceptInvitationBody = z.object({
  token: z.string().min(20),
});

export const UploadUrlBody = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: MimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const CreateDocumentBody = z.object({
  storageKey: z.string().min(8).max(400),
  kind: DocumentKindSchema,
  title: z.string().trim().min(1).max(200),
  mimeType: MimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  effectiveDate: DateOnly.nullable().optional(),
  expiresAt: DateOnly.nullable().optional(),
  inFunderPacket: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const UpdateDocumentBody = z.object({
  kind: DocumentKindSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  effectiveDate: DateOnly.nullable().optional(),
  expiresAt: DateOnly.nullable().optional(),
  inFunderPacket: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const CreateContentBlockBody = z.object({
  category: ContentCategorySchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().max(100_000),
});

export const UpdateContentBlockBody = z.object({
  category: ContentCategorySchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
  markReviewed: z.boolean().optional(),
});

export const FunderBody = z.object({
  name: z.string().trim().min(2).max(200),
  type: FunderTypeSchema,
  website: z.string().trim().url().nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  geographicFocus: z.array(z.string().trim().min(1)).max(40).optional(),
  focusAreas: z.array(FocusAreaSchema).optional(),
  eligibleOrgTypes: z.array(OrgTypeSchema).optional(),
  curatorNotes: z.string().max(8000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const OpportunityBody = z.object({
  funderId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(1).max(8000),
  url: z.string().trim().url().nullable().optional(),
  fundingForm: FundingFormSchema.optional(),
  eligibleOrgTypes: z.array(OrgTypeSchema).optional(),
  eligibleCommunities: z.array(z.string().trim().min(1)).max(40).optional(),
  focusAreas: z.array(FocusAreaSchema).optional(),
  minAmount: MoneyString.nullable().optional(),
  maxAmount: MoneyString.nullable().optional(),
  matchRequired: z.boolean().optional(),
  matchNotes: z.string().max(2000).nullable().optional(),
  deadlineType: DeadlineTypeSchema,
  deadlineAt: z.string().datetime().nullable().optional(),
  deadlineTimezone: z.string().nullable().optional(),
  loiDeadlineAt: z.string().datetime().nullable().optional(),
  opensAt: z.string().datetime().nullable().optional(),
  recurrenceNote: z.string().max(500).nullable().optional(),
  assistanceListing: z.string().max(40).nullable().optional(),
  requiresSam: z.boolean().optional(),
  status: OpportunityStatusSchema.optional(),
  isPublic: z.boolean().optional(),
  curatorNotes: z.string().max(8000).nullable().optional(),
});

export const OpportunityQuery = z.object({
  q: z.string().trim().max(200).optional(),
  funderType: FunderTypeSchema.optional(),
  fundingForm: FundingFormSchema.optional(),
  focusArea: FocusAreaSchema.optional(),
  community: z.string().trim().max(120).optional(),
  status: z.enum(["OPEN", "UPCOMING"]).optional(),
  minAmount: MoneyString.optional(),
  maxAmount: MoneyString.optional(),
  deadlineWithinDays: z.coerce.number().int().positive().max(365).optional(),
  fitForOrgId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const ImportOpportunitiesBody = z.object({
  csv: z.string().min(1).max(500_000),
});

export const CreateApplicationBody = z.object({
  title: z.string().trim().min(1).max(200),
  customFunderName: z.string().trim().max(200).optional(),
  amountRequested: MoneyString.optional(),
  funderDeadlineAt: z.string().datetime().optional(),
  internalDueAt: z.string().datetime().optional(),
  notes: z.string().max(10000).optional(),
});

export const UpdateApplicationBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: ApplicationStatusSchema.optional(),
  customFunderName: z.string().trim().max(200).nullable().optional(),
  amountRequested: MoneyString.nullable().optional(),
  amountAwarded: MoneyString.nullable().optional(),
  funderDeadlineAt: z.string().datetime().nullable().optional(),
  internalDueAt: z.string().datetime().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  decisionAt: z.string().datetime().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  declineFeedback: z.string().max(8000).nullable().optional(),
});

export const ChecklistItemBody = z.object({
  label: z.string().trim().min(1).max(300),
  kind: ChecklistKindSchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  linkedDocumentId: z.string().nullable().optional(),
  done: z.boolean().optional(),
});

export const ReorderChecklistBody = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const CreateComplianceBody = z.object({
  kind: ComplianceKindSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  dueAt: DateOnly,
  rrule: z.string().max(500).nullable().optional(),
  templateId: z.string().max(80).optional(),
});

export const UpdateComplianceBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueAt: DateOnly.optional(),
  rrule: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  linkedDocumentId: z.string().nullable().optional(),
});

export const ComplianceTemplateQuery = z.object({
  orgType: OrgTypeSchema,
  receivesFederalFunds: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export const CalendarQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const DigestSubscribeBody = z.object({
  email,
  communities: z.array(z.string().trim().min(1)).max(40).optional(),
  focusAreas: z.array(FocusAreaSchema).max(20).optional(),
});

export const DigestIssueBody = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  bodyMd: z.string().max(50_000).optional(),
  opportunityIds: z.array(z.string()).optional(),
});

export const PlatformSettingBody = z.object({
  value: z.string().max(4000),
});

export const UserLookupQuery = z.object({
  email: z.string().trim().email(),
});

export const SectionBody = z.object({
  heading: z.string().trim().min(1).max(200),
  prompt: z.string().max(8_000).default(""),
  wordLimit: z.number().int().positive().nullable().optional(),
  charLimit: z.number().int().positive().nullable().optional(),
  body: z.string().max(100_000).optional(),
});

export const UpdateSectionBody = SectionBody.partial();

export const DraftSectionBody = z.object({
  contentBlockIds: z.array(z.string()).max(20),
  dataPointIds: z.array(z.string()).max(20),
  tone: z.enum(["plain", "formal", "warm"]),
  targetWords: z.number().int().positive().max(5_000),
});

export const ReviewSectionBody = z.object({
  criteria: z
    .array(
      z.object({
        criterion: z.string().trim().min(1).max(500),
        points: z.number().nullable(),
      }),
    )
    .min(1)
    .max(40),
});

export const StartRfpParseBody = z.object({
  applicationId: z.string().min(1).nullable(),
});

export const ApplyRfpBody = z.object({
  applyTitle: z.boolean(),
  title: z.string().max(200),
  applyDeadline: z.boolean(),
  deadlineIso: z.string().max(40),
  sections: z
    .array(
      z.object({
        include: z.boolean(),
        heading: z.string().max(200),
        prompt: z.string().max(8_000),
        limit: z.string().max(200),
      }),
    )
    .max(40),
});

export const SupportLetterBody = z.object({
  partnerName: z.string().trim().min(1).max(200),
  partnerEmail: email,
  draftBody: z.string().trim().min(1).max(20_000),
  dueAt: z.string().datetime().nullable(),
});

export const PacketShareBody = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(30),
  expiresInDays: z.number().int().min(1).max(90),
  password: z.string().min(8).max(100).nullable(),
});

export const DataPointBody = z.object({
  community: z.string().trim().min(1).max(120),
  metric: z.string().trim().min(1).max(200),
  value: z.string().regex(/^-?\d+(\.\d+)?$/),
  unit: z.string().trim().min(1).max(40),
  year: z.number().int().min(1900).max(2100),
  sourceName: z.string().trim().min(1).max(200),
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
});

export const PastAwardBody = z.object({
  funderId: z.string().min(1),
  recipientName: z.string().trim().min(1).max(200),
  recipientOrgId: z.string().min(1).nullable(),
  community: z.string().trim().min(1).max(120),
  amount: MoneyString,
  year: z.number().int().min(1900).max(2100),
  purpose: z.string().trim().min(1).max(500),
  sourceUrl: z.string().url(),
});

export const QuizBody = z.object({
  orgType: OrgTypeSchema,
  community: z.string().trim().min(1).max(120),
  focus: FocusAreaSchema,
  federal: z.enum(["yes", "no"]),
});

export const FitSchema = z.object({
  label: z.enum(["good_fit", "possible_fit", "not_eligible"]),
  score: z.number(),
  reasons: z.array(z.string()),
  text: z.string(),
});

export const DeadlineSchema = z.object({
  at: z.string().nullable(),
  primary: z.string().nullable(),
  original: z.string().nullable(),
  timezonesDiffer: z.boolean(),
});
