import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('s3.region');
    this.bucket = this.configService.getOrThrow<string>('s3.bucket');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('s3.accessKeyId'),
        secretAccessKey:
          this.configService.getOrThrow<string>('s3.secretAccessKey'),
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
