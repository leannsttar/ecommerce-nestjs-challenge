import { registerAs } from '@nestjs/config';

export const rateLimitConfig = registerAs('rateLimit', () => ({
  short: {
    ttl: Number(process.env.THROTTLE_SHORT_TTL),
    limit: Number(process.env.THROTTLE_SHORT_LIMIT),
  },
  medium: {
    ttl: Number(process.env.THROTTLE_MEDIUM_TTL),
    limit: Number(process.env.THROTTLE_MEDIUM_LIMIT),
  },
  long: {
    ttl: Number(process.env.THROTTLE_LONG_TTL),
    limit: Number(process.env.THROTTLE_LONG_LIMIT),
  },
}));