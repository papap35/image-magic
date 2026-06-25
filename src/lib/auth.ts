export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}

export interface UserUpsertData {
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Map a Google OAuth profile into the fields used to create/update a User row.
 */
export function buildUserUpsertData(profile: GoogleProfile): UserUpsertData {
  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
  };
}
