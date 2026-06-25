import { getServerSession } from "next-auth";
import { authOptions } from "@/services/auth";

/**
 * Resolve the current user's id from the server session, or null if unauthenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
