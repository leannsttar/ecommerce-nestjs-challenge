import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../../common/config/namespaces/jwt.config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UserRole } from '@prisma/client';
import { parseDurationToMs } from '../../../utils/parse-duration';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  async generateAccessToken(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const expirationConfig = this.jwtConfiguration.expiration;
    const expirationMs = parseDurationToMs(expirationConfig);
    const expiresInSeconds = Math.floor(expirationMs / 1000);

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresInSeconds,
    });

    return { accessToken, expiresIn: expiresInSeconds };
  }
}
