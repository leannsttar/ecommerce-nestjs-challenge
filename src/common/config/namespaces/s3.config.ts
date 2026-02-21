import { registerAs } from '@nestjs/config';

export const s3Config = registerAs('s3', () => ({
  region: process.env.AWS_S3_REGION,
  bucket: process.env.AWS_S3_BUCKET,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}));
