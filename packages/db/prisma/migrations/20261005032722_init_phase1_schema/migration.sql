-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'CURATOR', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('NONPROFIT_501C3', 'FISCALLY_SPONSORED', 'TRIBE', 'TRIBAL_ORGANIZATION', 'ANCSA_CORPORATION', 'MUNICIPALITY', 'SMALL_BUSINESS', 'INDIVIDUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'SPONSORED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('IRS_DETERMINATION_LETTER', 'W9', 'FORM_990', 'AUDITED_FINANCIALS', 'FINANCIAL_STATEMENT', 'ORG_BUDGET', 'BOARD_LIST', 'BYLAWS', 'ARTICLES_OF_INCORPORATION', 'INSURANCE_CERTIFICATE', 'STRATEGIC_PLAN', 'ANNUAL_REPORT', 'LETTER_OF_SUPPORT', 'RFP_NOFO', 'GRANT_AGREEMENT', 'LOGO', 'PHOTO', 'RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentCategory" AS ENUM ('MISSION', 'ORG_HISTORY', 'PROGRAM_DESCRIPTION', 'NEED_STATEMENT', 'GOALS_OBJECTIVES', 'EVALUATION_PLAN', 'SUSTAINABILITY', 'ORG_CAPACITY', 'COMMUNITY_ENGAGEMENT', 'BUDGET_NARRATIVE', 'KEY_PERSONNEL', 'OTHER');

-- CreateEnum
CREATE TYPE "FunderType" AS ENUM ('PRIVATE_FOUNDATION', 'COMMUNITY_FOUNDATION', 'CORPORATE', 'ANCSA_CORPORATION', 'TRIBAL', 'FEDERAL', 'STATE', 'LOCAL_GOVERNMENT', 'CDFI_LENDER', 'NONPROFIT_INTERMEDIARY', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingForm" AS ENUM ('GRANT', 'LOAN', 'FORGIVABLE_LOAN', 'IN_KIND', 'PRIZE_AWARD', 'CONTRACT');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('FIXED', 'ROLLING', 'LOI_THEN_FULL', 'INVITATION_ONLY');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'UPCOMING', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PROSPECT', 'PLANNING', 'DRAFTING', 'INTERNAL_REVIEW', 'SUBMITTED', 'AWARDED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ChecklistItemKind" AS ENUM ('NARRATIVE', 'ATTACHMENT', 'BUDGET', 'SIGNATURE', 'SUPPORT_LETTER', 'REGISTRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('MANUAL', 'TEMPLATE', 'RFP_PARSER');

-- CreateEnum
CREATE TYPE "ComplianceKind" AS ENUM ('SAM_REGISTRATION', 'IRS_990', 'ALASKA_BIENNIAL_REPORT', 'PICK_CLICK_GIVE', 'INSURANCE_RENEWAL', 'BOARD_ELECTION', 'ANNUAL_MEETING', 'SINGLE_AUDIT', 'BUSINESS_LICENSE', 'FUNDER_REPORT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderTarget" AS ENUM ('OPPORTUNITY_DEADLINE', 'APPLICATION_DUE', 'CHECKLIST_ITEM', 'COMPLIANCE_ITEM', 'DOCUMENT_EXPIRY');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DigestIssueStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Juneau',
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "lastActiveOrgId" TEXT,
    "calendarTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "digestWeekday" INTEGER NOT NULL DEFAULT 1,
    "digestHour" INTEGER NOT NULL DEFAULT 8,
    "reminderOffsets" INTEGER[] DEFAULT ARRAY[30, 14, 7, 2, 1]::INTEGER[],
    "quietStartHour" INTEGER NOT NULL DEFAULT 21,
    "quietEndHour" INTEGER NOT NULL DEFAULT 8,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "community" TEXT NOT NULL,
    "servesCommunities" TEXT[],
    "ein" TEXT,
    "uei" TEXT,
    "website" TEXT,
    "mission" TEXT,
    "annualBudget" DECIMAL(14,2),
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "focusAreas" TEXT[],
    "receivesFederalFunds" BOOLEAN NOT NULL DEFAULT false,
    "fiscalSponsorName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Juneau',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "aggregateDataConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "effectiveDate" DATE,
    "expiresAt" DATE,
    "inFunderPacket" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "ContentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "charCount" INTEGER NOT NULL,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlockVersion" (
    "id" TEXT NOT NULL,
    "contentBlockId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBlockVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "FunderType" NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "geographicFocus" TEXT[],
    "focusAreas" TEXT[],
    "eligibleOrgTypes" "OrgType"[],
    "curatorNotes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT,
    "fundingForm" "FundingForm" NOT NULL DEFAULT 'GRANT',
    "eligibleOrgTypes" "OrgType"[],
    "eligibleCommunities" TEXT[],
    "focusAreas" TEXT[],
    "minAmount" DECIMAL(14,2),
    "maxAmount" DECIMAL(14,2),
    "matchRequired" BOOLEAN NOT NULL DEFAULT false,
    "matchNotes" TEXT,
    "deadlineType" "DeadlineType" NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "deadlineTimezone" TEXT,
    "loiDeadlineAt" TIMESTAMP(3),
    "opensAt" TIMESTAMP(3),
    "recurrenceNote" TEXT,
    "assistanceListing" TEXT,
    "requiresSam" BOOLEAN NOT NULL DEFAULT false,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "curatorNotes" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityWatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "customFunderName" TEXT,
    "title" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PROSPECT',
    "amountRequested" DECIMAL(14,2),
    "amountAwarded" DECIMAL(14,2),
    "funderDeadlineAt" TIMESTAMP(3),
    "internalDueAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "notes" TEXT,
    "declineFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "ChecklistItemKind" NOT NULL DEFAULT 'OTHER',
    "source" "ItemSource" NOT NULL DEFAULT 'MANUAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "doneAt" TIMESTAMP(3),
    "linkedDocumentId" TEXT,
    "notes" TEXT,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ComplianceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" DATE NOT NULL,
    "rrule" TEXT,
    "lastCompletedAt" TIMESTAMP(3),
    "linkedDocumentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetType" "ReminderTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "dueAtSnapshot" TIMESTAMP(3) NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "communities" TEXT[],
    "focusAreas" TEXT[],
    "confirmTokenHash" TEXT,
    "unsubTokenHash" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestIssue" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "opportunityIds" TEXT[],
    "status" "DigestIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigestIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarTokenHash_key" ON "User"("calendarTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginToken_tokenHash_key" ON "LoginToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginToken_email_createdAt_idx" ON "LoginToken"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_organizationId_kind_idx" ON "Document"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "ContentBlock_organizationId_category_idx" ON "ContentBlock"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlockVersion_contentBlockId_version_key" ON "ContentBlockVersion"("contentBlockId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Funder_slug_key" ON "Funder"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_slug_key" ON "Opportunity"("slug");

-- CreateIndex
CREATE INDEX "Opportunity_status_deadlineAt_idx" ON "Opportunity"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "Opportunity_funderId_idx" ON "Opportunity"("funderId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityWatch_organizationId_opportunityId_key" ON "OpportunityWatch"("organizationId", "opportunityId");

-- CreateIndex
CREATE INDEX "Application_organizationId_status_idx" ON "Application"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ChecklistItem_applicationId_idx" ON "ChecklistItem"("applicationId");

-- CreateIndex
CREATE INDEX "ComplianceItem_organizationId_dueAt_idx" ON "ComplianceItem"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_status_sendAt_idx" ON "Reminder"("status", "sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_targetType_targetId_recipientId_channel_offsetDays_key" ON "Reminder"("targetType", "targetId", "recipientId", "channel", "offsetDays");

-- CreateIndex
CREATE UNIQUE INDEX "DigestSubscriber_email_key" ON "DigestSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DigestSubscriber_confirmTokenHash_key" ON "DigestSubscriber"("confirmTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DigestSubscriber_unsubTokenHash_key" ON "DigestSubscriber"("unsubTokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlock" ADD CONSTRAINT "ContentBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlockVersion" ADD CONSTRAINT "ContentBlockVersion_contentBlockId_fkey" FOREIGN KEY ("contentBlockId") REFERENCES "ContentBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityWatch" ADD CONSTRAINT "OpportunityWatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityWatch" ADD CONSTRAINT "OpportunityWatch_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
