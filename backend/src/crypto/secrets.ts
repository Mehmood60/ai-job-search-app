import crypto from 'crypto';
import { env } from '../config/env';

// AES-256-GCM encryption for API keys at rest.
// Key is derived from APP_SECRET so it is deterministic across restarts.
const KEY = crypto.createHash('sha256').update(env.APP_SECRET).digest(); // 32 bytes
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // tolerate legacy/plain values
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Mask a secret for display: keep last 4 chars.
export function maskSecret(plain: string): string {
  if (!plain) return '';
  if (plain.length <= 4) return '••••';
  return '••••••••' + plain.slice(-4);
}
