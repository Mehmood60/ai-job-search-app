import { PrismaClient } from '@prisma/client';
import { DataLayer, ProfileRepo, SettingsRepo, UserRepo } from '../repositories';
import { Profile, Settings, User } from '../types';

// Postgres data layer via Prisma. Profile/Settings are stored as JSON blobs
// (a `data` column) so the shape matches the JSON store exactly — swapping
// drivers requires no feature-code changes.
export function createPostgresDataLayer(): DataLayer {
  const prisma = new PrismaClient();

  const users: UserRepo = {
    async findByEmail(email) {
      const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      return u ? toUser(u) : null;
    },
    async findById(id) {
      const u = await prisma.user.findUnique({ where: { id } });
      return u ? toUser(u) : null;
    },
    async create(user: User) {
      const u = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email.toLowerCase(),
          passwordHash: user.passwordHash,
          createdAt: new Date(user.createdAt),
        },
      });
      return toUser(u);
    },
  };

  const profiles: ProfileRepo = {
    async get(userId) {
      const row = await prisma.profile.findUnique({ where: { userId } });
      return row ? (row.data as unknown as Profile) : null;
    },
    async upsert(profile: Profile) {
      await prisma.profile.upsert({
        where: { userId: profile.userId },
        create: { userId: profile.userId, data: profile as unknown as object },
        update: { data: profile as unknown as object },
      });
      return profile;
    },
  };

  const settings: SettingsRepo = {
    async get(userId) {
      const row = await prisma.settings.findUnique({ where: { userId } });
      return row ? (row.data as unknown as Settings) : null;
    },
    async upsert(s: Settings) {
      await prisma.settings.upsert({
        where: { userId: s.userId },
        create: { userId: s.userId, data: s as unknown as object },
        update: { data: s as unknown as object },
      });
      return s;
    },
  };

  return {
    users,
    profiles,
    settings,
    async init() {
      await prisma.$connect();
    },
  };
}

function toUser(u: { id: string; email: string; passwordHash: string; createdAt: Date }): User {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt.toISOString(),
  };
}
