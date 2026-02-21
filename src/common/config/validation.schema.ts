import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),
  DATABASE_URL: Joi.string().required(),

  // jwt config
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('15m'),

  // refresh token config
  REFRESH_TOKEN_EXPIRATION: Joi.string().default('7d'),

  // reset password token config
  RESET_PASSWORD_TOKEN_EXPIRATION: Joi.string().default('10m'),

  //email
  SENDGRID_API_KEY: Joi.string().required(),
  SENDGRID_FROM_EMAIL: Joi.string().email().required(),

  //stripe
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),

  //rate limit
  THROTTLE_SHORT_TTL: Joi.number().default(1000),
  THROTTLE_SHORT_LIMIT: Joi.number().default(3),

  THROTTLE_MEDIUM_TTL: Joi.number().default(10000),
  THROTTLE_MEDIUM_LIMIT: Joi.number().default(20),

  THROTTLE_LONG_TTL: Joi.number().default(60000),
  THROTTLE_LONG_LIMIT: Joi.number().default(100),
});
