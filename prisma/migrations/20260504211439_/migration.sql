CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "ExemplarKind" AS ENUM ('CONTENT_POST', 'DM_REPLY');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('IG_CAPTION', 'REEL_SCRIPT', 'CAROUSEL', 'YOUTUBE_INTRO', 'STORY_QA', 'DM');

-- CreateEnum
CREATE TYPE "Offer" AS ENUM ('COURSE', 'ACCELERATOR', 'INNER_CIRCLE', 'NONE');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED', 'REJECTED', 'SCHEDULED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DmIntent" AS ENUM ('PURCHASE_READY', 'PRODUCT_QUALITY', 'PRICE_SHOPPER', 'GENERAL_QUESTION', 'NOT_A_FIT', 'SPAM', 'OBJECTION');

-- CreateEnum
CREATE TYPE "DmTemperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "DmDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "Exemplar" (
    "id" TEXT NOT NULL,
    "kind" "ExemplarKind" NOT NULL,
    "channel" "Channel" NOT NULL,
    "rating" "Rating" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "sourceDraftId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exemplar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "kind" "ExemplarKind" NOT NULL,
    "channel" "Channel" NOT NULL,
    "offer" "Offer" NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pipelineJson" TEXT NOT NULL,
    "generationLogJson" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "dmThreadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edit" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "beforeText" TEXT NOT NULL,
    "afterText" TEXT NOT NULL,
    "changeNote" TEXT,

    CONSTRAINT "Edit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmThread" (
    "id" TEXT NOT NULL,
    "senderHandle" TEXT NOT NULL,
    "intent" "DmIntent",
    "temperature" "DmTemperature",
    "isResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DmThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "DmDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "draftId" TEXT,

    CONSTRAINT "DmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exemplar_kind_channel_rating_idx" ON "Exemplar"("kind", "channel", "rating");

-- CreateIndex
CREATE INDEX "Draft_kind_status_idx" ON "Draft"("kind", "status");

-- CreateIndex
CREATE INDEX "Draft_scheduledFor_idx" ON "Draft"("scheduledFor");

-- CreateIndex
CREATE INDEX "DmThread_intent_temperature_idx" ON "DmThread"("intent", "temperature");

-- CreateIndex
CREATE INDEX "DmThread_isResolved_idx" ON "DmThread"("isResolved");

-- AddForeignKey
ALTER TABLE "Exemplar" ADD CONSTRAINT "Exemplar_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_dmThreadId_fkey" FOREIGN KEY ("dmThreadId") REFERENCES "DmThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edit" ADD CONSTRAINT "Edit_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DmThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
