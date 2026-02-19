import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { parseDurationToMs } from '../../../utils/parse-duration';

export interface ResetTokenData {
  resetToken: string;
  resetTokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class ResetTokenService {
  constructor(private readonly config: ConfigService) {}

  //returns Object containing plain token (for email), hashed token (for DB), and expiration date

  createResetTokenData(): ResetTokenData {
    const resetToken = this.generateResetToken();
    const resetTokenHash = this.hashResetToken(resetToken);
    const expiresAt = this.calculateExpirationDate();

    return { resetToken, resetTokenHash, expiresAt };
  }

  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  calculateExpirationDate(): Date {
    const expirationMs = parseDurationToMs(
      this.config.getOrThrow<string>('app.resetPasswordTokenExpiration'),
    );
    return new Date(Date.now() + expirationMs);
  }
}
