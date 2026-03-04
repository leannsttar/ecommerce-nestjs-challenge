import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../../common/config/namespaces/app.config';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshToken } from '@prisma/client';
import * as crypto from 'crypto';

import { parseDurationToMs } from '../../../utils/parse-duration';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {}

  async createRefreshToken(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expirationString = this.appConfiguration.refreshTokenExpiration;
    const expiresAt = this.calculateExpiration(expirationString);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async validateRefreshToken(token: string): Promise<RefreshToken> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (refreshToken.revokedAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return refreshToken;
  }

  async revokeRefreshTokenById(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private calculateExpiration(duration: string | number): Date {
    const expirationMs = parseDurationToMs(duration);
    return new Date(Date.now() + expirationMs);
  }
}
