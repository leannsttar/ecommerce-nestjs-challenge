import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

import { resetPasswordMessage } from '../templates/password-reset.template';
import { passwordChangeMessage } from '../templates/password-change.template';
import { stockNotificationMessage } from '../templates/stock-notification.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    sgMail.setApiKey(
      this.configService.getOrThrow<string>('app.sendgridApiKey'),
    );
    this.fromEmail = this.configService.getOrThrow<string>(
      'app.sendgridFromEmail',
    );
  }

  async sendResetPasswordEmail(
    email: string,
    token: string,
    expiresAt: Date,
    requestDate: Date,
  ) {
    const resetPasswordUrl = `myfrontend/reset-password?token=${token}`;
    const msg = {
      to: email,
      from: this.fromEmail,
      ...resetPasswordMessage(resetPasswordUrl, token, expiresAt, requestDate),
    };

    await sgMail.send(msg);
  }

  async sendChangedPasswordEmail(email: string, date: Date) {
    const msg = {
      to: email,
      from: this.fromEmail,
      ...passwordChangeMessage(date),
    };

    await sgMail.send(msg);
  }

  async sendStockNotificationEmail(
    email: string,
    productName: string,
    productImage: string,
  ) {
    const msg = {
      to: email,
      from: this.fromEmail,
      ...stockNotificationMessage(productName, productImage),
    };

    if (this.configService.get('NODE_ENV') !== 'test') {
      await sgMail.send(msg);
    } else {
      this.logger.log(`Sending stock notification to: ${email}`);
    }
  }
}
