-- CreateEnum
CREATE TYPE "MafiaStatus" AS ENUM ('LOBBY', 'PLAYING');

-- CreateTable
CREATE TABLE "MafiaRoom" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "MafiaStatus" NOT NULL DEFAULT 'LOBBY',
    "members" JSONB NOT NULL DEFAULT '[]',
    "game" JSONB,
    "banned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MafiaRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MafiaRoom_expiresAt_idx" ON "MafiaRoom"("expiresAt");
