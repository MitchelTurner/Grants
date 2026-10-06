-- CreateEnum
CREATE TYPE "SectionSource" AS ENUM ('MANUAL', 'RFP_PARSER');

-- CreateEnum
CREATE TYPE "RfpParseStatus" AS ENUM ('QUEUED', 'RUNNING', 'NEEDS_REVIEW', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportLetterStatus" AS ENUM ('REQUESTED', 'VIEWED', 'UPLOADED', 'DECLINED');

-- CreateTable
CREATE TABLE "ApplicationSection" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "wordLimit" INTEGER,
    "charLimit" INTEGER,
    "body" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" "SectionSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpParse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "documentId" TEXT NOT NULL,
    "status" "RfpParseStatus" NOT NULL DEFAULT 'QUEUED',
    "model" TEXT NOT NULL,
    "result" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfpParse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "estCostMicros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataPoint" (
    "id" TEXT NOT NULL,
    "community" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "curatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportLetterRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerEmail" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SupportLetterStatus" NOT NULL DEFAULT 'REQUESTED',
    "dueAt" TIMESTAMP(3),
    "uploadedDocumentId" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportLetterRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketShare" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "documentIds" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacketShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastAward" (
    "id" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientOrgId" TEXT,
    "community" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "year" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PastAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationSection_applicationId_sortOrder_idx" ON "ApplicationSection"("applicationId", "sortOrder");

-- CreateIndex
CREATE INDEX "RfpParse_organizationId_createdAt_idx" ON "RfpParse"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RfpParse_applicationId_idx" ON "RfpParse"("applicationId");

-- CreateIndex
CREATE INDEX "AiUsage_organizationId_createdAt_idx" ON "AiUsage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DataPoint_community_year_idx" ON "DataPoint"("community", "year");

-- CreateIndex
CREATE UNIQUE INDEX "SupportLetterRequest_tokenHash_key" ON "SupportLetterRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "SupportLetterRequest_applicationId_idx" ON "SupportLetterRequest"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "PacketShare_tokenHash_key" ON "PacketShare"("tokenHash");

-- CreateIndex
CREATE INDEX "PacketShare_organizationId_idx" ON "PacketShare"("organizationId");

-- CreateIndex
CREATE INDEX "PastAward_funderId_year_idx" ON "PastAward"("funderId", "year");

-- AddForeignKey
ALTER TABLE "ApplicationSection" ADD CONSTRAINT "ApplicationSection_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpParse" ADD CONSTRAINT "RfpParse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpParse" ADD CONSTRAINT "RfpParse_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpParse" ADD CONSTRAINT "RfpParse_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataPoint" ADD CONSTRAINT "DataPoint_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLetterRequest" ADD CONSTRAINT "SupportLetterRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLetterRequest" ADD CONSTRAINT "SupportLetterRequest_uploadedDocumentId_fkey" FOREIGN KEY ("uploadedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLetterRequest" ADD CONSTRAINT "SupportLetterRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShare" ADD CONSTRAINT "PacketShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShare" ADD CONSTRAINT "PacketShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastAward" ADD CONSTRAINT "PastAward_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "Funder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

