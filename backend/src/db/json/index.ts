import path from 'path';
import { env } from '../../config/env';
import { DataLayer, ProfileRepo, SettingsRepo, UserRepo } from '../repositories';
import { Profile, Settings, User } from '../types';
import { JsonStore } from './store';

export function createJsonDataLayer(): DataLayer {
  const filePath = path.isAbsolute(env.JSON_DB_PATH)
    ? env.JSON_DB_PATH
    : path.resolve(process.cwd(), env.JSON_DB_PATH);
  const store = new JsonStore(filePath);

  const users: UserRepo = {
    async findByEmail(email) {
      return store.read().users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async findById(id) {
      return store.read().users.find((u) => u.id === id) ?? null;
    },
    async create(user: User) {
      return store.mutate((db) => {
        db.users.push(user);
        return user;
      });
    },
  };

  const profiles: ProfileRepo = {
    async get(userId) {
      return store.read().profiles.find((p) => p.userId === userId) ?? null;
    },
    async upsert(profile: Profile) {
      return store.mutate((db) => {
        const idx = db.profiles.findIndex((p) => p.userId === profile.userId);
        if (idx >= 0) db.profiles[idx] = profile;
        else db.profiles.push(profile);
        return profile;
      });
    },
  };

  const settings: SettingsRepo = {
    async get(userId) {
      return store.read().settings.find((s) => s.userId === userId) ?? null;
    },
    async upsert(s: Settings) {
      return store.mutate((db) => {
        const idx = db.settings.findIndex((x) => x.userId === s.userId);
        if (idx >= 0) db.settings[idx] = s;
        else db.settings.push(s);
        return s;
      });
    },
  };

  return {
    users,
    profiles,
    settings,
    async init() {
      await store.load();
    },
  };
}
