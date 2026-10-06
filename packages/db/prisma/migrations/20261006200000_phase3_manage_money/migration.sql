-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'REIMBURSEMENT', 'MIXED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('PERSONNEL', 'FRINGE', 'TRAVEL', 'FREIGHT', 'EQUIPMENT', 'SUPPLIES', 'CONTRACTUAL', 'CONSTRUCTION', 'OTHER', 'INDIRECT');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('PROGRESS', 'FINANCIAL', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'SITE_VISIT');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'GRANT_REPORT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderTarget" ADD VALUE 'REPORT_DUE';
ALTER TYPE "ReminderTarget" ADD VALUE 'FUNDER_FOLLOW_UP';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "isFederal" BOOLEAN NOT NULL DEFAULT false,
    "assistanceListing" TEXT,
    "matchRequiredAmount" DECIMAL(14,2),
    "restrictions" TEXT,
    "agreementDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "budgeted" DECIMAL(14,2) NOT NULL,
    "isMatch" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expenditure" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "vendor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "receiptDocumentId" TEXT,
    "reimbursementRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expenditure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementRequest" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "expectedPaidAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT,
    "userId" TEXT,
    "volunteerName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(8,2),
    "inKindValue" DECIMAL(14,2),
    "rate" DECIMAL(8,2),
    "description" TEXT NOT NULL,
    "photoDocumentIds" TEXT[],
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRequirement" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "submittedAt" TIMESTAMP(3),
    "generatedDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" DECIMAL(14,2) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricEntry" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MetricEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunderInteraction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "funderId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "date" DATE NOT NULL,
    "type" "InteractionType" NOT NULL,
    "summary" TEXT NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunderInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Award_applicationId_key" ON "Award"("applicationId");

-- CreateIndex
CREATE INDEX "Award_organizationId_idx" ON "Award"("organizationId");

-- CreateIndex
CREATE INDEX "BudgetLine_awardId_idx" ON "BudgetLine"("awardId");

-- CreateIndex
CREATE INDEX "Expenditure_awardId_date_idx" ON "Expenditure"("awardId", "date");

-- CreateIndex
CREATE INDEX "ReimbursementRequest_awardId_idx" ON "ReimbursementRequest"("awardId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEntry_clientId_key" ON "MatchEntry"("clientId");

-- CreateIndex
CREATE INDEX "MatchEntry_organizationId_date_idx" ON "MatchEntry"("organizationId", "date");

-- CreateIndex
CREATE INDEX "ReportRequirement_awardId_dueAt_idx" ON "ReportRequirement"("awardId", "dueAt");

-- CreateIndex
CREATE INDEX "Metric_awardId_idx" ON "Metric"("awardId");

-- CreateIndex
CREATE INDEX "MetricEntry_metricId_date_idx" ON "MetricEntry"("metricId", "date");

-- CreateIndex
CREATE INDEX "FunderInteraction_organizationId_date_idx" ON "FunderInteraction"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expenditure" ADD CONSTRAINT "Expenditure_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expenditure" ADD CONSTRAINT "Expenditure_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expenditure" ADD CONSTRAINT "Expenditure_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementRequest" ADD CONSTRAINT "ReimbursementRequest_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRequirement" ADD CONSTRAINT "ReportRequirement_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricEntry" ADD CONSTRAINT "MetricEntry_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderInteraction" ADD CONSTRAINT "FunderInteraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderInteraction" ADD CONSTRAINT "FunderInteraction_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

