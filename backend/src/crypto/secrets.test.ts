import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, maskSecret } from './secrets';

describe('secrets', () => {
  it('round-trips an encrypted value', () => {
    const plain = 'sk-test-1234567890';
    const enc = encryptSecret(plain);
    expect(enc).not.toEqual(plain);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(enc)).toEqual(plain);
  });

  it('handles empty values', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('tolerates a legacy plaintext value on decrypt', () => {
    expect(decryptSecret('plain-value')).toBe('plain-value');
  });

  it('masks all but the last four characters', () => {
    expect(maskSecret('abcd1234')).toMatch(/1234$/);
    expect(maskSecret('')).toBe('');
  });
});
