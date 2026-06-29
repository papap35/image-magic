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

/**
 * Save the user's preferred model override for a provider they've already
 * saved a key for. `model: null` clears the override so the provider falls
 * back to its own built-in default.
 */
export async function saveUserProviderModel(userId: string, provider: string, model: string | null) {
  await prisma.providerApiKey.update({
    where: { userId_provider: { userId, provider } },
    data: { model },
  });
}

/** Returns the user's saved model override for a provider, or null if none saved. */
export async function getUserProviderModel(userId: string, provider: string): Promise<string | null> {
  const row = await prisma.providerApiKey.findUnique({ where: { userId_provider: { userId, provider } } });
  return row?.model ?? null;
}

/** Returns a map of provider -> saved model override, for providers the user has a key for. */
export async function listUserProviderModels(userId: string): Promise<Record<string, string | null>> {
  const rows = await prisma.providerApiKey.findMany({ where: { userId }, select: { provider: true, model: true } });
  return Object.fromEntries(rows.map((row: { provider: string; model: string | null }) => [row.provider, row.model]));
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
