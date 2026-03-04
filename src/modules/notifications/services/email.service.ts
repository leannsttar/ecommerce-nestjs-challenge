import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../../common/config/namespaces/app.config';
import sgMail from '@sendgrid/mail';

import { resetPasswordMessage } from '../templates/password-reset.template';
import { passwordChangeMessage } from '../templates/password-change.template';
import { stockNotificationMessage } from '../templates/stock-notification.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {
    sgMail.setApiKey(this.appConfiguration.sendgridApiKey);
    this.fromEmail = this.appConfiguration.sendgridFromEmail;
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

    if (this.appConfiguration.environment !== 'test') {
      await sgMail.send(msg);
    } else {
      this.logger.log(`Sending stock notification to: ${email}`);
    }
  }
}
