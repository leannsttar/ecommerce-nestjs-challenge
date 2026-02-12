import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT as string, 10),
  corsOrigin: process.env.CORS_ORIGIN,
  environment: process.env.NODE_ENV,
  apiPrefix: 'api',
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION,
  resetPasswordTokenExpiration:
    parseInt(process.env.RESET_PASSWORD_TOKEN_EXPIRATION as string, 10),
}));
