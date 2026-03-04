import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { s3Config } from '../../common/config/namespaces/s3.config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PresignedUrlResponse } from './dto/presigned-url.response';

@Injectable()
export class UploadsService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  /** URL is valid for 15 minutes — enough time to complete a single PUT request */
  private readonly EXPIRATION_SECONDS = 900;

  constructor(
    @Inject(s3Config.KEY)
    private readonly s3Configuration: ConfigType<typeof s3Config>,
  ) {
    this.region = this.s3Configuration.region;
    this.bucket = this.s3Configuration.bucket;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.s3Configuration.accessKeyId,
        secretAccessKey: this.s3Configuration.secretAccessKey,
      },
    });
  }

  async generatePresignedUrl(
    fileName: string,
    contentType: string,
  ): Promise<PresignedUrlResponse> {
    // Build a unique, path-prefixed key to avoid collisions and keep files organized
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `uploads/${randomUUID()}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.EXPIRATION_SECONDS,
    });

    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { presignedUrl, publicUrl, key };
  }
}
