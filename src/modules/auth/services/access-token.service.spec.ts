import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import type { StringValue } from 'ms';
import { UserRole } from '@prisma/client';
import { createMock } from '@golevelup/ts-jest';
import { jwtConfig } from '../../../common/config/namespaces/jwt.config';
import { AccessTokenService } from './access-token.service';

/**
 * parseDurationToMs is NOT mocked — it is pure and covered by its own spec.
 * Letting it run here also validates the integration between the two units.
 */
describe('AccessTokenService', () => {
  let service: AccessTokenService;
  let jwtService: jest.Mocked<JwtService>;
  let jwtConfiguration: ConfigType<typeof jwtConfig>;

  beforeEach(() => {
    jwtService = createMock<JwtService>();
    jwtService.sign.mockReturnValue('signed.jwt.token');
    jwtConfiguration = {
      secret: 'test-secret',
      expiration: '15m' as StringValue,
    } as ConfigType<typeof jwtConfig>;

    service = new AccessTokenService(jwtService, jwtConfiguration);
  });

  // ─── generateAccessToken ──────────────────────────────────────────────────

  describe('generateAccessToken', () => {
    const userId = 'user-uuid-123';
    const email = 'alice@example.com';
    const role = UserRole.CLIENT;

    it('returns the signed token and expiresIn in seconds', async () => {
      const result = await service.generateAccessToken(userId, email, role);

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        expiresIn: 900, // 15m → 900 s
      });
    });

    it('calls JwtService.sign with the correct payload and expiry', async () => {
      await service.generateAccessToken(userId, email, role);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: userId, email, role },
        { expiresIn: 900 },
      );
    });

    it('forwards the role exactly as received', async () => {
      await service.generateAccessToken(userId, email, UserRole.MANAGER);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.MANAGER }),
        expect.any(Object),
      );
    });

    // ─── duration conversion ─────────────────────────────────────────────────

    it.each([
      ['15m', 900],
      ['1h', 3_600],
      ['7d', 604_800],
      ['30s', 30],
    ])(
      'converts config value "%s" → expiresIn %i seconds',
      async (configValue, expectedSeconds) => {
        jwtConfiguration.expiration = configValue as StringValue;

        const result = await service.generateAccessToken(userId, email, role);

        expect(result.expiresIn).toBe(expectedSeconds);
        expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
          expiresIn: expectedSeconds,
        });
      },
    );

    it('throws when ConfigType logic gets an invalid duration string', async () => {
      jwtConfiguration.expiration = 'invalid' as StringValue;

      await expect(
        service.generateAccessToken(userId, email, role),
      ).rejects.toThrow('Invalid duration format: invalid');
    });
  });
});
