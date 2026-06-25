-- AlterTable
ALTER TABLE "Image" ADD COLUMN "aiTagSuggestions" JSONB;
ALTER TABLE "Image" ADD COLUMN "aiRecognitionError" TEXT;
