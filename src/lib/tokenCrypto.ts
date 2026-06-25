import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded)");
  }
  return key;
}

/**
 * Encrypt a plaintext token for storage. Output format is
 * `iv:authTag:ciphertext`, each base64-encoded, so it can be stored as a
 * single string column.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Decrypt a token previously produced by `encryptToken`.
 */
export function decryptToken(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted token format");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
