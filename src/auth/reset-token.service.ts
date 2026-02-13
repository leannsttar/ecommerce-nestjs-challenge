import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { parseDuration } from '../utils/parse-duration';

@Injectable()
export class ResetTokenService {
  constructor(private readonly config: ConfigService) {}

  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  calculateExpirationDate(): Date {
    const expirationMs = parseDuration(
      this.config.getOrThrow<string>('app.resetPasswordTokenExpiration'),
    );
    return new Date(Date.now() + expirationMs);
  }
}
