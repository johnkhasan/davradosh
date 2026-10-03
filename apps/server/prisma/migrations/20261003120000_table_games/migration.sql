-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('LOBBY', 'PLAYING');

-- CreateTable
CREATE TABLE "TableRoom" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "options" JSONB,
    "status" "TableStatus" NOT NULL DEFAULT 'LOBBY',
    "members" JSONB NOT NULL DEFAULT '[]',
    "game" JSONB,
    "round" INTEGER NOT NULL DEFAULT 0,
    "banned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyResult" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "ms" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableRoom_expiresAt_idx" ON "TableRoom"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyResult_day_playerId_key" ON "DailyResult"("day", "playerId");

-- CreateIndex
CREATE INDEX "DailyResult_day_ms_idx" ON "DailyResult"("day", "ms");
