import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PasswordService } from './services/password.service';
import { ResetTokenService } from './services/reset-token.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { AccessTokenService } from './services/access-token.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { UserRole } from '@prisma/client';
import { AuthResult } from './types/auth-result.type';
import { EmailService } from '../notifications/services/email.service';

import { parseDurationToMs } from '../utils/parse-duration';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly resetTokenService: ResetTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly accessTokenService: AccessTokenService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthResult> {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      // role: dto.role,
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async signIn(dto: SignInDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const storedToken =
      await this.refreshTokenService.validateRefreshToken(refreshToken);
    const user = await this.usersService.findById(storedToken.userId);

    await this.refreshTokenService.revokeRefreshTokenById(storedToken.id);

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async signOut(refreshToken: string): Promise<void> {
    const storedToken =
      await this.refreshTokenService.validateRefreshToken(refreshToken);
    await this.refreshTokenService.revokeRefreshTokenById(storedToken.id);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // dont reveal that the user does not exist
      return;
    }

    const { resetToken, resetTokenHash, expiresAt } =
      this.resetTokenService.createResetTokenData();

    await this.usersService.saveResetToken(user.id, resetTokenHash, expiresAt);

    // MOCKED EMAIL: print token in console for testing
    console.log('='.repeat(80));
    console.log('   PASSWORD RESET TOKEN (Copy this for testing):');
    console.log(`   Email: ${user.email}`);
    console.log(`   Token: ${resetToken}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);
    console.log('='.repeat(80));

    try {
      await this.emailService.sendResetPasswordEmail(
        user.email,
        resetToken,
        expiresAt,
        new Date(),
      );
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.resetTokenService.hashResetToken(token);
    const user = await this.usersService.findByResetToken(tokenHash);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newPasswordHash =
      await this.passwordService.hashPassword(newPassword);
    await this.usersService.updatePasswordAndClearResetToken(
      user.id,
      newPasswordHash,
    );

    // revoke all user refresh tokens for security
    await this.refreshTokenService.revokeAllUserTokens(user.id);

    try {
      await this.emailService.sendChangedPasswordEmail(user.email, new Date());
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  private async buildAuthResponse(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthResult> {
    const { accessToken, expiresIn } =
      await this.accessTokenService.generateAccessToken(userId, email, role);
    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken(userId);
    const refreshTokenExpiration = this.config.getOrThrow<number>(
      'app.refreshTokenExpiration',
    );
    const refreshTokenExpirationMs = parseDurationToMs(refreshTokenExpiration);

    return { accessToken, expiresIn, refreshToken, refreshTokenExpirationMs };
  }
}
