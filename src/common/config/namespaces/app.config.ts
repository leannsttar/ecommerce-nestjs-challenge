import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN,
  environment: process.env.NODE_ENV,
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION,
  resetPasswordTokenExpiration: process.env.RESET_PASSWORD_TOKEN_EXPIRATION,

  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
}));
