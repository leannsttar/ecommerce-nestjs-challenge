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
  RESET_PASSWORD_TOKEN_EXPIRATION: Joi.number().default(3600000), // 1 h
});
