import { prisma } from "@/lib/db";
import { getVisionProvider } from "@/services/visionProviders";
import { generateAndStoreImageEmbedding } from "@/services/imageEmbeddings";

const DEFAULT_PROVIDER = "openai-vision";

/**
 * Run AI captioning/tag-suggestion for an already-uploaded image. This is an
 * enhancement, not part of the critical generation path: it never throws —
 * failures are recorded on `Image.aiRecognitionError` so they don't affect
 * the GenerationJob's success/failure status.
 */
export async function runImageRecognition(imageId: string): Promise<void> {
  const image = await prisma.image.findUnique({ where: { id: imageId } });
  const imageUrl = image?.driveViewUrl;
  if (!imageUrl) {
    return;
  }

  const provider = getVisionProvider(DEFAULT_PROVIDER);
  if (!provider) {
    return;
  }

  try {
    const result = await provider.recognize({ imageUrl });
    await prisma.image.update({
      where: { id: imageId },
      data: { aiCaption: result.caption, aiTagSuggestions: result.tags, aiRecognitionError: null },
    });
    await generateAndStoreImageEmbedding(imageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.image.update({ where: { id: imageId }, data: { aiRecognitionError: message } });
  }
}
