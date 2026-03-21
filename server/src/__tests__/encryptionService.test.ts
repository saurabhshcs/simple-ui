import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../services/auth/encryptionService';

describe('encryptionService', () => {
  describe('encrypt', () => {
    it('returns a string in iv:tag:ciphertext hex format', () => {
      const result = encrypt('hello');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      // Each part must be non-empty valid hex
      parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/));
    });

    it('produces different ciphertext on each call (random IV)', () => {
      const a = encrypt('same-plaintext');
      const b = encrypt('same-plaintext');
      expect(a).not.toBe(b);
    });
  });

  describe('decrypt', () => {
    it('roundtrips a plain string', () => {
      const plaintext = 'sk-test-api-key-1234567890';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('roundtrips a unicode string', () => {
      const unicode = '日本語テスト 🔐';
      expect(decrypt(encrypt(unicode))).toBe(unicode);
    });

    it('throws on a malformed stored value (missing parts)', () => {
      expect(() => decrypt('onlyone')).toThrow('Invalid encrypted value format');
    });

    it('throws when ciphertext is tampered (GCM auth tag mismatch)', () => {
      const stored = encrypt('sensitive');
      const parts = stored.split(':');
      // Flip the last char of the ciphertext
      parts[2] = parts[2]!.slice(0, -1) + (parts[2]!.endsWith('f') ? '0' : 'f');
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });
});
