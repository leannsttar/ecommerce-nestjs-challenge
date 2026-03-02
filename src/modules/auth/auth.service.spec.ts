import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshToken, User, UserRole } from '@prisma/client';
import { createMock } from '@golevelup/ts-jest';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from './services/password.service';
import { ResetTokenService } from './services/reset-token.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { AccessTokenService } from './services/access-token.service';
import { EmailService } from '../notifications/services/email.service';

/**
 * parseDurationToMs is NOT mocked — it is pure and covered by its own spec.
 * Letting it run here also validates the integration between the two units.
 */

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const USER_EMAIL = 'alice@example.com';

const mockStoredRefreshToken: RefreshToken = {
  id: 'rt-uuid-1',
  userId: USER_ID,
  tokenHash: 'stored-token-hash',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  createdAt: new Date('2024-01-01'),
};

const mockUser: User = {
  id: USER_ID,
  email: USER_EMAIL,
  role: UserRole.CLIENT,
  passwordHash: 'stored-hash',
  fullName: 'Alice',
  stripeCustomerId: null,
  resetPasswordTokenHash: null,
  resetPasswordExpires: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

// ─── AuthService ──────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let passwordService: jest.Mocked<PasswordService>;
  let resetTokenService: jest.Mocked<ResetTokenService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let accessTokenService: jest.Mocked<AccessTokenService>;
  let configService: jest.Mocked<ConfigService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    usersService = createMock<UsersService>();
    passwordService = createMock<PasswordService>();
    resetTokenService = createMock<ResetTokenService>();
    refreshTokenService = createMock<RefreshTokenService>();
    accessTokenService = createMock<AccessTokenService>();
    configService = createMock<ConfigService>();
    emailService = createMock<EmailService>();

    // Default stubs used by buildAuthResponse (called by signUp, signIn, refresh)
    accessTokenService.generateAccessToken.mockResolvedValue({
      accessToken: 'access.token.jwt',
      expiresIn: 900,
    });
    refreshTokenService.createRefreshToken.mockResolvedValue({
      token: 'plain-refresh-token',
      expiresAt: new Date(),
    });
    // '7d' → 604_800_000 ms — parseDurationToMs runs for real
    configService.getOrThrow.mockReturnValue('7d');

    service = new AuthService(
      usersService,
      passwordService,
      resetTokenService,
      refreshTokenService,
      accessTokenService,
      configService,
      emailService,
    );
  });

  // ─── signUp ────────────────────────────────────────────────────────────────

  describe('signUp', () => {
    const dto = {
      email: USER_EMAIL,
      password: 'plain-password',
      fullName: 'Alice',
    };

    beforeEach(() => {
      passwordService.hashPassword.mockResolvedValue('hashed-password');
      usersService.create.mockResolvedValue(mockUser);
    });

    it('returns a complete AuthResult on success', async () => {
      const actual = await service.signUp(dto);

      expect(actual).toEqual({
        accessToken: 'access.token.jwt',
        expiresIn: 900,
        refreshToken: 'plain-refresh-token',
        refreshTokenExpirationMs: 604_800_000, // 7d
      });
    });

    it('hashes the password before persisting the user', async () => {
      await service.signUp(dto);

      expect(passwordService.hashPassword).toHaveBeenCalledWith(
        'plain-password',
      );
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed-password' }),
      );
    });

    it('never passes the plain-text password to usersService.create', async () => {
      await service.signUp(dto);

      const createArg = usersService.create.mock.calls[0][0];
      expect(createArg).not.toHaveProperty('password');
    });

    it('issues the access token for the newly created user', async () => {
      await service.signUp(dto);

      expect(accessTokenService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role,
      );
    });

    it('propagates ConflictException when the email is already registered', async () => {
      usersService.create.mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      await expect(service.signUp(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── signIn ────────────────────────────────────────────────────────────────

  describe('signIn', () => {
    const dto = { email: USER_EMAIL, password: 'plain-password' };

    beforeEach(() => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(true);
    });

    it('returns a complete AuthResult for valid credentials', async () => {
      const actual = await service.signIn(dto);

      expect(actual).toEqual({
        accessToken: 'access.token.jwt',
        expiresIn: 900,
        refreshToken: 'plain-refresh-token',
        refreshTokenExpirationMs: 604_800_000,
      });
    });

    it('throws UnauthorizedException when the user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.signIn(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is incorrect', async () => {
      passwordService.comparePassword.mockResolvedValue(false);

      await expect(service.signIn(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('uses the same error message for both failure paths to prevent user enumeration', async () => {
      // Path 1: user not found
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.signIn(dto)).rejects.toThrow('Invalid credentials');

      // Path 2: wrong password
      usersService.findByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(false);
      await expect(service.signIn(dto)).rejects.toThrow('Invalid credentials');
    });

    it('validates the supplied password against the stored hash', async () => {
      await service.signIn(dto);

      expect(passwordService.comparePassword).toHaveBeenCalledWith(
        'plain-password',
        mockUser.passwordHash,
      );
    });

    it('does not call comparePassword when the user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await service.signIn(dto).catch(() => {});

      expect(passwordService.comparePassword).not.toHaveBeenCalled();
    });

    it('issues the access token for the authenticated user', async () => {
      await service.signIn(dto);

      expect(accessTokenService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role,
      );
    });
  });

  // ─── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const plainToken = 'old-plain-refresh-token';

    beforeEach(() => {
      refreshTokenService.validateRefreshToken.mockResolvedValue(
        mockStoredRefreshToken,
      );
      usersService.findById.mockResolvedValue(mockUser);
    });

    it('returns a complete AuthResult on success', async () => {
      const actual = await service.refresh(plainToken);

      expect(actual).toEqual({
        accessToken: 'access.token.jwt',
        expiresIn: 900,
        refreshToken: 'plain-refresh-token',
        refreshTokenExpirationMs: 604_800_000,
      });
    });

    it('revokes the old token before issuing a new one', async () => {
      await service.refresh(plainToken);

      expect(refreshTokenService.revokeRefreshTokenById).toHaveBeenCalledWith(
        mockStoredRefreshToken.id,
      );
    });

    it('loads the user from the userId embedded in the stored token', async () => {
      await service.refresh(plainToken);

      expect(usersService.findById).toHaveBeenCalledWith(
        mockStoredRefreshToken.userId,
      );
    });

    it('throws UnauthorizedException for an invalid or expired refresh token', async () => {
      refreshTokenService.validateRefreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      await expect(service.refresh(plainToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user associated with the token no longer exists', async () => {
      usersService.findById.mockResolvedValue(null as unknown as User);

      await expect(service.refresh(plainToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a new access token for the owner of the refresh token', async () => {
      await service.refresh(plainToken);

      expect(accessTokenService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role,
      );
    });
  });

  // ─── signOut ───────────────────────────────────────────────────────────────

  describe('signOut', () => {
    const plainToken = 'old-plain-refresh-token';

    beforeEach(() => {
      refreshTokenService.validateRefreshToken.mockResolvedValue(
        mockStoredRefreshToken,
      );
    });

    it('revokes the validated token by its id', async () => {
      await service.signOut(plainToken);

      expect(refreshTokenService.revokeRefreshTokenById).toHaveBeenCalledWith(
        mockStoredRefreshToken.id,
      );
    });

    it('throws UnauthorizedException for an invalid refresh token', async () => {
      refreshTokenService.validateRefreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      await expect(service.signOut(plainToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    const resetTokenData = {
      resetToken: 'plain-reset-token',
      resetTokenHash: 'hashed-reset-token',
      expiresAt: new Date(Date.now() + 3_600_000),
    };

    it('returns silently when the email is not registered — does not reveal user existence', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const actual = await service.forgotPassword(USER_EMAIL);

      expect(actual).toBeUndefined();
      expect(resetTokenService.createResetTokenData).not.toHaveBeenCalled();
      expect(emailService.sendResetPasswordEmail).not.toHaveBeenCalled();
    });

    it('saves the hashed reset token — not the plain token — to the database', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      resetTokenService.createResetTokenData.mockReturnValue(resetTokenData);
      usersService.saveResetToken.mockResolvedValue(mockUser);
      emailService.sendResetPasswordEmail.mockResolvedValue(undefined);

      await service.forgotPassword(USER_EMAIL);

      expect(usersService.saveResetToken).toHaveBeenCalledWith(
        USER_ID,
        resetTokenData.resetTokenHash,
        resetTokenData.expiresAt,
      );
    });

    it('sends the plain reset token in the email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      resetTokenService.createResetTokenData.mockReturnValue(resetTokenData);
      usersService.saveResetToken.mockResolvedValue(mockUser);
      emailService.sendResetPasswordEmail.mockResolvedValue(undefined);

      await service.forgotPassword(USER_EMAIL);

      expect(emailService.sendResetPasswordEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        resetTokenData.resetToken,
        resetTokenData.expiresAt,
        expect.any(Date),
      );
    });

    it('does not throw when email delivery fails', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      resetTokenService.createResetTokenData.mockReturnValue(resetTokenData);
      usersService.saveResetToken.mockResolvedValue(mockUser);
      emailService.sendResetPasswordEmail.mockRejectedValue(
        new Error('SMTP failure'),
      );

      await expect(service.forgotPassword(USER_EMAIL)).resolves.toBeUndefined();
    });
  });

  // ─── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const plainToken = 'plain-reset-token';
    const tokenHash = 'hashed-reset-token';
    const newPassword = 'newSecurePassword!1';

    beforeEach(() => {
      resetTokenService.hashResetToken.mockReturnValue(tokenHash);
      usersService.findByResetToken.mockResolvedValue(mockUser);
      passwordService.hashPassword.mockResolvedValue('new-hashed-password');
      usersService.updatePasswordAndClearResetToken.mockResolvedValue(mockUser);
      emailService.sendChangedPasswordEmail.mockResolvedValue(undefined);
    });

    it('throws BadRequestException("Invalid or expired reset token") for an invalid or expired token', async () => {
      usersService.findByResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword(plainToken, newPassword),
      ).rejects.toThrow(new BadRequestException('Invalid or expired reset token'));
    });

    it('looks up the user by the sha256 hash of the supplied token', async () => {
      await service.resetPassword(plainToken, newPassword);

      expect(resetTokenService.hashResetToken).toHaveBeenCalledWith(plainToken);
      expect(usersService.findByResetToken).toHaveBeenCalledWith(tokenHash);
    });

    it('updates the password with a hash — never stores the plain-text password', async () => {
      await service.resetPassword(plainToken, newPassword);

      expect(passwordService.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(
        usersService.updatePasswordAndClearResetToken,
      ).toHaveBeenCalledWith(USER_ID, 'new-hashed-password');
    });

    it('revokes all active refresh tokens after the password change', async () => {
      await service.resetPassword(plainToken, newPassword);

      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('sends a password-changed confirmation email', async () => {
      await service.resetPassword(plainToken, newPassword);

      expect(emailService.sendChangedPasswordEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(Date),
      );
    });

    it('does not throw when the confirmation email fails to send', async () => {
      emailService.sendChangedPasswordEmail.mockRejectedValue(
        new Error('SMTP failure'),
      );

      await expect(
        service.resetPassword(plainToken, newPassword),
      ).resolves.toBeUndefined();
    });
  });
});
