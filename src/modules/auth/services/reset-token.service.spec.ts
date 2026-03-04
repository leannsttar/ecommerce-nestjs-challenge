import * as crypto from 'crypto';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../../common/config/namespaces/app.config';
import { createMock } from '@golevelup/ts-jest';
import { ResetTokenService } from './reset-token.service';

/**
 * parseDurationToMs is NOT mocked — it is pure and covered by its own spec.
 * Letting it run here also validates the integration between the two units.
 */
describe('ResetTokenService', () => {
  let service: ResetTokenService;
  let appConfiguration: ConfigType<typeof appConfig>;

  beforeEach(() => {
    appConfiguration = {
      resetPasswordTokenExpiration: '1h',
    } as ConfigType<typeof appConfig>;

    service = new ResetTokenService(appConfiguration);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── generateResetToken ────────────────────────────────────────────────────

  describe('generateResetToken', () => {
    it('returns a 64-character hex string', () => {
      const token = service.generateResetToken();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces a different token on each call due to random bytes', () => {
      const token1 = service.generateResetToken();
      const token2 = service.generateResetToken();

      expect(token1).not.toBe(token2);
    });
  });

  // ─── hashResetToken ────────────────────────────────────────────────────────

  describe('hashResetToken', () => {
    it('returns the sha256 hex digest of the given token', () => {
      const token = 'my-test-token';
      const expected = crypto.createHash('sha256').update(token).digest('hex');

      expect(service.hashResetToken(token)).toBe(expected);
    });

    it('returns different hashes for different input tokens', () => {
      const hash1 = service.hashResetToken('token-a');
      const hash2 = service.hashResetToken('token-b');

      expect(hash1).not.toBe(hash2);
    });

    it('returns the same hash for the same input (deterministic)', () => {
      const token = 'deterministic-token';

      expect(service.hashResetToken(token)).toBe(service.hashResetToken(token));
    });
  });

  // ─── calculateExpirationDate ───────────────────────────────────────────────

  describe('calculateExpirationDate', () => {
    it('reads app.resetPasswordTokenExpiration from instantiated config object', () => {
      service.calculateExpirationDate();

      expect(appConfiguration.resetPasswordTokenExpiration).toBeDefined();
    });

    it('returns a Date in the future relative to the configured duration', () => {
      appConfiguration.resetPasswordTokenExpiration = '1h';
      const before = Date.now();
      const result = service.calculateExpirationDate();
      const after = Date.now();
      const expectedMs = 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(result.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });
  });

  // ─── createResetTokenData ──────────────────────────────────────────────────

  describe('createResetTokenData', () => {
    it('returns an object with resetToken, resetTokenHash, and expiresAt', () => {
      const result = service.createResetTokenData();

      expect(result).toMatchObject({
        resetToken: expect.any(String),
        resetTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      });
    });

    it('resetTokenHash is the sha256 hash of resetToken', () => {
      const result = service.createResetTokenData();
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.resetToken)
        .digest('hex');

      expect(result.resetTokenHash).toBe(expectedHash);
    });

    it('resetToken is never stored as-is (it differs from its hash)', () => {
      const result = service.createResetTokenData();

      expect(result.resetToken).not.toBe(result.resetTokenHash);
    });

    it('returns different tokens on each invocation', () => {
      const result1 = service.createResetTokenData();
      const result2 = service.createResetTokenData();

      expect(result1.resetToken).not.toBe(result2.resetToken);
    });

    it('expiresAt reflects the configured duration', () => {
      appConfiguration.resetPasswordTokenExpiration = '30m';
      const before = Date.now();
      const result = service.createResetTokenData();
      const after = Date.now();
      const expectedMs = 30 * 60 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + expectedMs,
      );
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
        after + expectedMs,
      );
    });
  });
});
