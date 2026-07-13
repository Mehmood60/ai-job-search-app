import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getDataLayer } from '../db';
import { defaultSettings, emptyProfile, User } from '../db/types';
import { AppError } from '../http/errors';

const TOKEN_TTL = '7d';

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const db = await getDataLayer();
  const normalized = email.trim().toLowerCase();

  if (await db.users.findByEmail(normalized)) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  }

  const user: User = {
    id: crypto.randomUUID(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };
  await db.users.create(user);

  // Seed empty profile + default settings (Grok active) for the new user.
  await db.profiles.upsert(emptyProfile(user.id));
  await db.settings.upsert(defaultSettings(user.id));

  return { token: sign(user), user: { id: user.id, email: user.email } };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const db = await getDataLayer();
  const user = await db.users.findByEmail(email.trim().toLowerCase());
  if (!user) throw new AppError(401, 'Invalid email or password', 'BAD_CREDENTIALS');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid email or password', 'BAD_CREDENTIALS');

  return { token: sign(user), user: { id: user.id, email: user.email } };
}

function sign(user: User): string {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): { userId: string; email: string } {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    return { userId: String(payload.sub), email: String(payload.email) };
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'BAD_TOKEN');
  }
}
