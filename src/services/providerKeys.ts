import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";

/** Save (or update) a user's own API key for a BYOK provider, encrypted at rest. */
export async function saveUserProviderKey(userId: string, provider: string, apiKey: string) {
  const encryptedKey = encryptToken(apiKey);
  await prisma.providerApiKey.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, encryptedKey },
    update: { encryptedKey },
  });
}

/** Returns the user's decrypted API key for a provider, or null if none saved. */
export async function getUserProviderKey(userId: string, provider: string): Promise<string | null> {
  const row = await prisma.providerApiKey.findUnique({ where: { userId_provider: { userId, provider } } });
  return row ? decryptToken(row.encryptedKey) : null;
}

/** List provider names the user has a saved key for (never returns the key itself). */
export async function listUserProviderKeyNames(userId: string): Promise<string[]> {
  const rows = await prisma.providerApiKey.findMany({ where: { userId }, select: { provider: true } });
  return rows.map((row: { provider: string }) => row.provider);
}

/** Removes a user's saved key for a provider. No-op if none exists. */
export async function deleteUserProviderKey(userId: string, provider: string) {
  await prisma.providerApiKey.deleteMany({ where: { userId, provider } });
}
