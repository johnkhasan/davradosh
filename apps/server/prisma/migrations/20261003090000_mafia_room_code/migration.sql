-- AlterTable
ALTER TABLE "MafiaRoom" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MafiaRoom_code_key" ON "MafiaRoom"("code");
