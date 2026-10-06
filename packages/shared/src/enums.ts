import { z } from "zod";

export const PLATFORM_ROLES = ["USER", "CURATOR", "SUPERADMIN"] as const;
export const ORG_TYPES = [
  "NONPROFIT_501C3",
  "FISCALLY_SPONSORED",
  "TRIBE",
  "TRIBAL_ORGANIZATION",
  "ANCSA_CORPORATION",
  "MUNICIPALITY",
  "SMALL_BUSINESS",
  "INDIVIDUAL",
  "OTHER",
] as const;
export const MEMBER_ROLES = ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"] as const;
export const DOCUMENT_KINDS = [
  "IRS_DETERMINATION_LETTER",
  "W9",
  "FORM_990",
  "AUDITED_FINANCIALS",
  "FINANCIAL_STATEMENT",
  "ORG_BUDGET",
  "BOARD_LIST",
  "BYLAWS",
  "ARTICLES_OF_INCORPORATION",
  "INSURANCE_CERTIFICATE",
  "STRATEGIC_PLAN",
  "ANNUAL_REPORT",
  "LETTER_OF_SUPPORT",
  "RFP_NOFO",
  "GRANT_AGREEMENT",
  "LOGO",
  "PHOTO",
  "RECEIPT",
  "GRANT_REPORT",
  "OTHER",
] as const;
export const CONTENT_CATEGORIES = [
  "MISSION",
  "ORG_HISTORY",
  "PROGRAM_DESCRIPTION",
  "NEED_STATEMENT",
  "GOALS_OBJECTIVES",
  "EVALUATION_PLAN",
  "SUSTAINABILITY",
  "ORG_CAPACITY",
  "COMMUNITY_ENGAGEMENT",
  "BUDGET_NARRATIVE",
  "KEY_PERSONNEL",
  "OTHER",
] as const;
export const FUNDER_TYPES = [
  "PRIVATE_FOUNDATION",
  "COMMUNITY_FOUNDATION",
  "CORPORATE",
  "ANCSA_CORPORATION",
  "TRIBAL",
  "FEDERAL",
  "STATE",
  "LOCAL_GOVERNMENT",
  "CDFI_LENDER",
  "NONPROFIT_INTERMEDIARY",
  "OTHER",
] as const;
export const FUNDING_FORMS = [
  "GRANT",
  "LOAN",
  "FORGIVABLE_LOAN",
  "IN_KIND",
  "PRIZE_AWARD",
  "CONTRACT",
] as const;
export const DEADLINE_TYPES = ["FIXED", "ROLLING", "LOI_THEN_FULL", "INVITATION_ONLY"] as const;
export const OPPORTUNITY_STATUSES = ["DRAFT", "UPCOMING", "OPEN", "CLOSED", "ARCHIVED"] as const;
export const APPLICATION_STATUSES = [
  "PROSPECT",
  "PLANNING",
  "DRAFTING",
  "INTERNAL_REVIEW",
  "SUBMITTED",
  "AWARDED",
  "DECLINED",
  "WITHDRAWN",
] as const;
export const CHECKLIST_KINDS = [
  "NARRATIVE",
  "ATTACHMENT",
  "BUDGET",
  "SIGNATURE",
  "SUPPORT_LETTER",
  "REGISTRATION",
  "OTHER",
] as const;
export const COMPLIANCE_KINDS = [
  "SAM_REGISTRATION",
  "IRS_990",
  "ALASKA_BIENNIAL_REPORT",
  "PICK_CLICK_GIVE",
  "INSURANCE_RENEWAL",
  "BOARD_ELECTION",
  "ANNUAL_MEETING",
  "SINGLE_AUDIT",
  "BUSINESS_LICENSE",
  "FUNDER_REPORT",
  "CUSTOM",
] as const;

export const PlatformRoleSchema = z.enum(PLATFORM_ROLES);
export const OrgTypeSchema = z.enum(ORG_TYPES);
export const MemberRoleSchema = z.enum(MEMBER_ROLES);
export const DocumentKindSchema = z.enum(DOCUMENT_KINDS);
export const ContentCategorySchema = z.enum(CONTENT_CATEGORIES);
export const FunderTypeSchema = z.enum(FUNDER_TYPES);
export const FundingFormSchema = z.enum(FUNDING_FORMS);
export const DeadlineTypeSchema = z.enum(DEADLINE_TYPES);
export const OpportunityStatusSchema = z.enum(OPPORTUNITY_STATUSES);
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const ChecklistKindSchema = z.enum(CHECKLIST_KINDS);
export const ComplianceKindSchema = z.enum(COMPLIANCE_KINDS);

export type PlatformRole = z.infer<typeof PlatformRoleSchema>;
export type OrgType = z.infer<typeof OrgTypeSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type DocumentKind = z.infer<typeof DocumentKindSchema>;
export type ContentCategory = z.infer<typeof ContentCategorySchema>;
export type FunderType = z.infer<typeof FunderTypeSchema>;
export type FundingForm = z.infer<typeof FundingFormSchema>;
export type DeadlineType = z.infer<typeof DeadlineTypeSchema>;
export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type ChecklistKind = z.infer<typeof ChecklistKindSchema>;
export type ComplianceKind = z.infer<typeof ComplianceKindSchema>;

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  NONPROFIT_501C3: "501(c)(3) nonprofit",
  FISCALLY_SPONSORED: "Fiscally sponsored group",
  TRIBE: "Tribal government",
  TRIBAL_ORGANIZATION: "Tribal organization",
  ANCSA_CORPORATION: "ANCSA corporation",
  MUNICIPALITY: "City or borough",
  SMALL_BUSINESS: "Small business",
  INDIVIDUAL: "Individual",
  OTHER: "Other",
};

const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
  VIEWER: "Viewer",
};

const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  IRS_DETERMINATION_LETTER: "IRS determination letter",
  W9: "W-9",
  FORM_990: "Form 990",
  AUDITED_FINANCIALS: "Audited financials",
  FINANCIAL_STATEMENT: "Financial statement",
  ORG_BUDGET: "Organization budget",
  BOARD_LIST: "Board list",
  BYLAWS: "Bylaws",
  ARTICLES_OF_INCORPORATION: "Articles of incorporation",
  INSURANCE_CERTIFICATE: "Insurance certificate",
  STRATEGIC_PLAN: "Strategic plan",
  ANNUAL_REPORT: "Annual report",
  LETTER_OF_SUPPORT: "Letter of support",
  RFP_NOFO: "RFP or NOFO",
  GRANT_AGREEMENT: "Grant agreement",
  LOGO: "Logo",
  PHOTO: "Photo",
  RECEIPT: "Receipt",
  GRANT_REPORT: "Grant report",
  OTHER: "Other",
};

const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  MISSION: "Mission",
  ORG_HISTORY: "History",
  PROGRAM_DESCRIPTION: "Program description",
  NEED_STATEMENT: "Need statement",
  GOALS_OBJECTIVES: "Goals and objectives",
  EVALUATION_PLAN: "Evaluation plan",
  SUSTAINABILITY: "Sustainability",
  ORG_CAPACITY: "Organizational capacity",
  COMMUNITY_ENGAGEMENT: "Community engagement",
  BUDGET_NARRATIVE: "Budget narrative",
  KEY_PERSONNEL: "Key personnel",
  OTHER: "Other",
};

const FUNDER_TYPE_LABELS: Record<FunderType, string> = {
  PRIVATE_FOUNDATION: "Private foundation",
  COMMUNITY_FOUNDATION: "Community foundation",
  CORPORATE: "Corporate funder",
  ANCSA_CORPORATION: "ANCSA corporation",
  TRIBAL: "Tribal funder",
  FEDERAL: "Federal",
  STATE: "State",
  LOCAL_GOVERNMENT: "City or borough",
  CDFI_LENDER: "CDFI or lender",
  NONPROFIT_INTERMEDIARY: "Nonprofit intermediary",
  OTHER: "Other",
};

const FUNDING_FORM_LABELS: Record<FundingForm, string> = {
  GRANT: "Grant",
  LOAN: "Loan",
  FORGIVABLE_LOAN: "Forgivable loan",
  IN_KIND: "In-kind",
  PRIZE_AWARD: "Prize or award",
  CONTRACT: "Contract",
};

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PROSPECT: "Prospect",
  PLANNING: "Planning",
  DRAFTING: "Drafting",
  INTERNAL_REVIEW: "Internal review",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

const COMPLIANCE_KIND_LABELS: Record<ComplianceKind, string> = {
  SAM_REGISTRATION: "SAM.gov registration",
  IRS_990: "IRS Form 990",
  ALASKA_BIENNIAL_REPORT: "Alaska biennial report",
  PICK_CLICK_GIVE: "Pick.Click.Give",
  INSURANCE_RENEWAL: "Insurance renewal",
  BOARD_ELECTION: "Board election",
  ANNUAL_MEETING: "Annual meeting",
  SINGLE_AUDIT: "Single Audit",
  BUSINESS_LICENSE: "Business license",
  FUNDER_REPORT: "Funder report",
  CUSTOM: "Custom",
};

const CHECKLIST_KIND_LABELS: Record<ChecklistKind, string> = {
  NARRATIVE: "Narrative",
  ATTACHMENT: "Attachment",
  BUDGET: "Budget",
  SIGNATURE: "Signature",
  SUPPORT_LETTER: "Letter of support",
  REGISTRATION: "Registration",
  OTHER: "Other",
};

export function orgTypeLabel(value: OrgType): string {
  return ORG_TYPE_LABELS[value];
}
export function memberRoleLabel(value: MemberRole): string {
  return MEMBER_ROLE_LABELS[value];
}
export function documentKindLabel(value: DocumentKind): string {
  return DOCUMENT_KIND_LABELS[value];
}
export function contentCategoryLabel(value: ContentCategory): string {
  return CONTENT_CATEGORY_LABELS[value];
}
export function funderTypeLabel(value: FunderType): string {
  return FUNDER_TYPE_LABELS[value];
}
export function fundingFormLabel(value: FundingForm): string {
  return FUNDING_FORM_LABELS[value];
}
export function applicationStatusLabel(value: ApplicationStatus): string {
  return APPLICATION_STATUS_LABELS[value];
}
export function opportunityStatusLabel(value: OpportunityStatus): string {
  return OPPORTUNITY_STATUS_LABELS[value];
}
export function complianceKindLabel(value: ComplianceKind): string {
  return COMPLIANCE_KIND_LABELS[value];
}
export function checklistKindLabel(value: ChecklistKind): string {
  return CHECKLIST_KIND_LABELS[value];
}

/** Higher number means more access. SPEC §3. */
export const MEMBER_ROLE_RANK: Record<MemberRole, number> = {
  VIEWER: 1,
  CONTRIBUTOR: 2,
  EDITOR: 3,
  ADMIN: 4,
  OWNER: 5,
};

export function roleAtLeast(actual: MemberRole, required: MemberRole): boolean {
  return MEMBER_ROLE_RANK[actual] >= MEMBER_ROLE_RANK[required];
}
