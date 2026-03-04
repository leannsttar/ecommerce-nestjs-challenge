import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN as string,
  environment: process.env.NODE_ENV as string,
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION as string,
  resetPasswordTokenExpiration: process.env
    .RESET_PASSWORD_TOKEN_EXPIRATION as string,

  sendgridApiKey: process.env.SENDGRID_API_KEY as string,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL as string,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY as string,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET as string,
}));
