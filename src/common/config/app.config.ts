import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN,
  environment: process.env.NODE_ENV,
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION,
  resetPasswordTokenExpiration: process.env.RESET_PASSWORD_TOKEN_EXPIRATION,
}));
