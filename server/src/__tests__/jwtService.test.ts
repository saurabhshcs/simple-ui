import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../services/auth/jwtService';

// JWT_SECRET is set to 'a'.repeat(64) in setup.ts
const TEST_SECRET = 'a'.repeat(64);

describe('jwtService — pure token functions', () => {
  describe('signToken', () => {
    it('returns a token, jti (UUID), and expiresAt (ms timestamp)', () => {
      const { token, jti, expiresAt } = signToken('user-1', 'device-1');
      expect(typeof token).toBe('string');
      expect(jti).toMatch(/^[0-9a-f-]{36}$/); // UUID v4
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it('token payload contains sub, deviceId, and jti', () => {
      const { token, jti } = signToken('user-42', 'device-42');
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded['sub']).toBe('user-42');
      expect(decoded['deviceId']).toBe('device-42');
      expect(decoded['jti']).toBe(jti);
    });

    it('each call produces a unique jti', () => {
      const a = signToken('u', 'd');
      const b = signToken('u', 'd');
      expect(a.jti).not.toBe(b.jti);
    });
  });

  describe('verifyToken', () => {
    it('returns the payload for a valid token', () => {
      const { token, jti } = signToken('user-1', 'device-1');
      const payload = verifyToken(token);
      expect(payload.sub).toBe('user-1');
      expect(payload.deviceId).toBe('device-1');
      expect(payload.jti).toBe(jti);
    });

    it('throws for a token signed with a different secret', () => {
      const badToken = jwt.sign({ sub: 'x', deviceId: 'y', jti: 'z' }, 'wrong-secret');
      expect(() => verifyToken(badToken)).toThrow();
    });

    it('throws for an expired token', () => {
      const expired = jwt.sign(
        { sub: 'u', deviceId: 'd', jti: 'j' },
        TEST_SECRET,
        { expiresIn: -1 }, // already expired
      );
      expect(() => verifyToken(expired)).toThrow(/expired/i);
    });

    it('throws for a malformed token string', () => {
      expect(() => verifyToken('not.a.jwt')).toThrow();
    });
  });
});
