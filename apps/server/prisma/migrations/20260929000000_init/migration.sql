-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('PLAYING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "cols" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "rotation" BOOLEAN NOT NULL DEFAULT false,
    "maxPlayers" INTEGER NOT NULL DEFAULT 5,
    "status" "RoomStatus" NOT NULL DEFAULT 'PLAYING',
    "state" JSONB,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "credit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_expiresAt_idx" ON "Room"("expiresAt");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

