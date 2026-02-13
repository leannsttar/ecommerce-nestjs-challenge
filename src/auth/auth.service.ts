import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { ResetTokenService } from './reset-token.service';
import { RefreshTokenService } from './refresh-token.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UserRole } from 'generated/prisma/client';
import { AuthResult } from './types/auth-result.type';

import { parseDuration } from '../utils/parse-duration';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly resetTokenService: ResetTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthResult> {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash, 
      fullName: dto.fullName,
      // role: dto.role,
    });

    return this.generateAuthResult(user.id, user.email, user.role);
  }

  async signIn(dto: SignInDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmailOrNull(dto.email);

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

    return this.generateAuthResult(user.id, user.email, user.role);
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {

    const storedToken = await this.refreshTokenService.validateRefreshToken(refreshToken);
    const user = await this.usersService.findById(storedToken.userId);

    return this.generateAccessToken(user.id, user.email, user.role);
  }

  async signOut(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeRefreshToken(refreshToken);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmailOrNull(email);

    if (!user) {
      // Do not reveal that the user does not exist
      return;
    }

    const resetToken = this.resetTokenService.generateResetToken();
    const tokenHash = this.resetTokenService.hashResetToken(resetToken);
    const expiresAt = this.resetTokenService.calculateExpirationDate();

    await this.usersService.saveResetToken(user.id, tokenHash, expiresAt);

    // MOCKED EMAIL: print token in console for testing
    console.log('='.repeat(80));
    console.log('   PASSWORD RESET TOKEN (Copy this for testing):');
    console.log(`   Email: ${user.email}`);
    console.log(`   Token: ${resetToken}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);
    console.log('='.repeat(80));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.resetTokenService.hashResetToken(token);
    const user = await this.usersService.findByResetToken(tokenHash);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newPasswordHash =await this.passwordService.hashPassword(newPassword);
    await this.usersService.updatePasswordAndClearResetToken(user.id, newPasswordHash);

    // revoke all user refresh tokens for security
    await this.refreshTokenService.revokeAllUserTokens(user.id);
  }

  private async generateAccessToken(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const expirationConfig = this.config.get<string | number>('jwt.expiration', '15m');
    const expirationMs = parseDuration(expirationConfig);
    const expiresInSeconds = Math.floor(expirationMs / 1000);
    const accessToken = this.jwtService.sign(payload, { expiresIn: expiresInSeconds });

    return { accessToken, expiresIn: expiresInSeconds };
  }

  private async generateAuthResult(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthResult> {
    const { accessToken, expiresIn } = await this.generateAccessToken(
      userId,
      email,
      role,
    );
    const { token: refreshToken } = await this.refreshTokenService.createRefreshToken(userId);
    const refreshTokenExpiration = this.config.getOrThrow<number>('app.refreshTokenExpiration');
    const refreshTokenExpirationMs = parseDuration(refreshTokenExpiration);

    return { accessToken, expiresIn, refreshToken, refreshTokenExpirationMs };
  }
}
