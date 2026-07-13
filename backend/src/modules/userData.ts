import { getDataLayer } from '../db';
import { defaultSettings, emptyProfile, Profile, Settings } from '../db/types';

// Load a user's settings, seeding defaults if missing.
export async function loadSettings(userId: string): Promise<Settings> {
  const db = await getDataLayer();
  const existing = await db.settings.get(userId);
  if (existing) {
    // Ensure all provider keys exist (forward-compat if new providers are added).
    return {
      ...defaultSettings(userId),
      ...existing,
      apiKeys: { ...defaultSettings(userId).apiKeys, ...existing.apiKeys },
    };
  }
  const seeded = defaultSettings(userId);
  await db.settings.upsert(seeded);
  return seeded;
}

// Load a user's profile, seeding an empty one if missing.
export async function loadProfile(userId: string): Promise<Profile> {
  const db = await getDataLayer();
  const existing = await db.profiles.get(userId);
  if (existing) return existing;
  const seeded = emptyProfile(userId);
  await db.profiles.upsert(seeded);
  return seeded;
}
