import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { Image } from '../entities/image.entity';

@Resolver(() => Image)
export class ImageResolver {
  constructor(private readonly configService: ConfigService) {}

  @ResolveField(() => String)
  url(@Parent() image: Image) {
    if (!image.url) return null;
    // Fallback if the database has full URLs from previous stages (e.g. seed data)
    if (image.url.startsWith('http')) return image.url;

    const bucket = this.configService.getOrThrow('s3.bucket');
    const region = this.configService.getOrThrow('s3.region');
    // We treat image.url as the stored S3 key
    return `https://${bucket}.s3.${region}.amazonaws.com/${image.url}`;
  }
}
