import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createMock } from '@golevelup/ts-jest';
import { AccessTokenService } from './access-token.service';

/**
 * parseDurationToMs is NOT mocked — it is pure and covered by its own spec.
 * Letting it run here also validates the integration between the two units.
 */
describe('AccessTokenService', () => {
  let service: AccessTokenService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jwtService = createMock<JwtService>();
    configService = createMock<ConfigService>();

    jwtService.sign.mockReturnValue('signed.jwt.token');
    configService.getOrThrow.mockReturnValue('15m');

    service = new AccessTokenService(jwtService, configService);
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

    it('reads jwt.expiration from ConfigService', async () => {
      await service.generateAccessToken(userId, email, role);

      expect(configService.getOrThrow).toHaveBeenCalledWith('jwt.expiration');
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
        configService.getOrThrow.mockReturnValue(configValue);

        const result = await service.generateAccessToken(userId, email, role);

        expect(result.expiresIn).toBe(expectedSeconds);
        expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
          expiresIn: expectedSeconds,
        });
      },
    );

    it('throws when ConfigService returns an invalid duration string', async () => {
      configService.getOrThrow.mockReturnValue('invalid');

      await expect(
        service.generateAccessToken(userId, email, role),
      ).rejects.toThrow('Invalid duration format: invalid');
    });
  });
});
