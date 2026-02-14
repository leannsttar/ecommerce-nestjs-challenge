import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UserRole } from 'generated/prisma/client';
import { parseDurationToMs } from '../../utils/parse-duration';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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

    const expirationConfig = this.config.getOrThrow<string>('jwt.expiration');
    const expirationMs = parseDurationToMs(expirationConfig);
    const expiresInSeconds = Math.floor(expirationMs / 1000);
    
    const accessToken = this.jwtService.sign(payload, { expiresIn: expiresInSeconds });

    return { accessToken, expiresIn: expiresInSeconds };
  }
}
