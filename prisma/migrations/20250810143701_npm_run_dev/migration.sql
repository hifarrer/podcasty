-- CreateEnum
CREATE TYPE "public"."SourceType" AS ENUM ('YOUTUBE', 'WEB', 'PDF', 'TXT');

-- CreateEnum
CREATE TYPE "public"."ModeType" AS ENUM ('SUMMARY', 'READTHROUGH');

-- CreateEnum
CREATE TYPE "public"."EpisodeStatus" AS ENUM ('CREATED', 'INGESTING', 'SCRIPTING', 'SYNTHESIZING', 'AUDIO_POST', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "oauth_token_secret" TEXT,
    "oauth_token" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."Episode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "public"."SourceType" NOT NULL,
    "sourceUrl" TEXT,
    "uploadKey" TEXT,
    "mode" "public"."ModeType" NOT NULL DEFAULT 'SUMMARY',
    "language" TEXT NOT NULL DEFAULT 'en',
    "style" TEXT NOT NULL DEFAULT 'conversational',
    "voice" TEXT NOT NULL DEFAULT 'default',
    "targetMinutes" INTEGER,
    "includeIntro" BOOLEAN NOT NULL DEFAULT true,
    "includeOutro" BOOLEAN NOT NULL DEFAULT true,
    "includeMusic" BOOLEAN NOT NULL DEFAULT false,
    "chaptersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."EpisodeStatus" NOT NULL DEFAULT 'CREATED',
    "title" TEXT,
    "showNotesMd" TEXT,
    "ssml" TEXT,
    "estimatedWpm" INTEGER,
    "chaptersJson" JSONB,
    "audioUrl" TEXT,
    "audioBytes" BIGINT,
    "durationSec" INTEGER,
    "coverUrl" TEXT,
    "jobId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Podcasty Feed',
    "description" TEXT NOT NULL DEFAULT 'Episodes generated with Podcasty',
    "imageUrl" TEXT,
    "privateToken" TEXT NOT NULL,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventLog" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Episode_userId_createdAt_idx" ON "public"."Episode"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_userId_key" ON "public"."Feed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_privateToken_key" ON "public"."Feed"("privateToken");

-- CreateIndex
CREATE INDEX "EventLog_episodeId_createdAt_idx" ON "public"."EventLog"("episodeId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Episode" ADD CONSTRAINT "Episode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feed" ADD CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "public"."Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
