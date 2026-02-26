import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from '@prisma/client';
import { createMock } from '@golevelup/ts-jest';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * parseDurationToMs is NOT mocked — it is pure and covered by its own spec.
 * Letting it run here also validates the integration between the two units.
 */
describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prisma: DeepMockProxy<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    configService = createMock<ConfigService>();

    configService.getOrThrow.mockReturnValue('7d' as never);

    service = new RefreshTokenService(prisma, configService);
  });

  // ─── createRefreshToken ────────────────────────────────────────────────────

  describe('createRefreshToken', () => {
    const userId = 'user-uuid-1';

    beforeEach(() => {
      prisma.refreshToken.create.mockResolvedValue({} as never);
    });

    it('returns the plain token as a 64-char hex string', async () => {
      const result = await service.createRefreshToken(userId);

      expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different token on each call due to random bytes', async () => {
      const result1 = await service.createRefreshToken(userId);
      const result2 = await service.createRefreshToken(userId);

      expect(result1.token).not.toBe(result2.token);
    });

    it('returns an expiresAt Date in the future', async () => {
      const before = Date.now();
      const result = await service.createRefreshToken(userId);

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(before);
    });

    it('stores the sha256 hash of the returned token — not the plain token — in the database', async () => {
      const result = await service.createRefreshToken(userId);
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.token)
        .digest('hex');

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          tokenHash: expectedHash,
        }),
      });
    });

    it('never stores the plain token in the database', async () => {
      const result = await service.createRefreshToken(userId);
      const callArg = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0];

      expect(callArg.data.tokenHash).not.toBe(result.token);
    });

    it('reads app.refreshTokenExpiration from ConfigService', async () => {
      await service.createRefreshToken(userId);

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'app.refreshTokenExpiration',
      );
    });

    it('sets expiresAt relative to the configured duration', async () => {
      configService.getOrThrow.mockReturnValue('1h' as never);
      const before = Date.now();
      const result = await service.createRefreshToken(userId);
      const after = Date.now();
      const expectedMs = 60 * 60 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + expectedMs,
      );
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
        after + expectedMs,
      );
    });
  });

  // ─── validateRefreshToken ──────────────────────────────────────────────────

  describe('validateRefreshToken', () => {
    const plainToken = 'a'.repeat(64);
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');

    const validRecord: RefreshToken = {
      id: 'rt-uuid-1',
      userId: 'user-uuid-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000), // 1 min from now
      revokedAt: null,
      createdAt: new Date(),
    };

    it('returns the RefreshToken record for a valid token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);

      const result = await service.validateRefreshToken(plainToken);

      expect(result).toEqual(validRecord);
    });

    it('queries by sha256 hash of the supplied token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);

      await service.validateRefreshToken(plainToken);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
      });
    });

    it('throws UnauthorizedException when token is not found in the database', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.validateRefreshToken(plainToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token has expired', async () => {
      const expiredRecord = {
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      };
      prisma.refreshToken.findUnique.mockResolvedValue(expiredRecord);

      await expect(service.validateRefreshToken(plainToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token has been revoked', async () => {
      const revokedRecord = { ...validRecord, revokedAt: new Date() };
      prisma.refreshToken.findUnique.mockResolvedValue(revokedRecord);

      await expect(service.validateRefreshToken(plainToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('uses the message "Invalid or expired refresh token" for all failure cases', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.validateRefreshToken(plainToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });

  // ─── revokeRefreshTokenById ────────────────────────────────────────────────

  describe('revokeRefreshTokenById', () => {
    it('sets revokedAt on the token identified by id', async () => {
      const tokenId = 'rt-uuid-1';
      prisma.refreshToken.update.mockResolvedValue({} as never);

      await service.revokeRefreshTokenById(tokenId);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });
  });

  // ─── revokeAllUserTokens ───────────────────────────────────────────────────

  describe('revokeAllUserTokens', () => {
    it('bulk-revokes all active (non-revoked) tokens for the given user', async () => {
      const userId = 'user-uuid-1';
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.revokeAllUserTokens(userId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });
  });
});
