-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "model" TEXT;
ALTER TABLE "GenerationJob" ADD COLUMN     "completedAt" TIMESTAMP(3);
