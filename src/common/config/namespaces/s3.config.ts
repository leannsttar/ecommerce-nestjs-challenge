import { registerAs } from '@nestjs/config';

export const s3Config = registerAs('s3', () => ({
  region: process.env.AWS_S3_REGION as string,
  bucket: process.env.AWS_S3_BUCKET as string,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
}));
