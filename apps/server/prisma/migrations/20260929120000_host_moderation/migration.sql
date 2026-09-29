-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "banned" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rounds started when their room was created.
UPDATE "Room" SET "startedAt" = "createdAt";
