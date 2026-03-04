import { registerAs } from '@nestjs/config';
import type { StringValue } from 'ms';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET as string,
  expiration: process.env.JWT_EXPIRATION as StringValue,
}));
