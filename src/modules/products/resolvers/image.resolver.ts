import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { s3Config } from '../../../common/config/namespaces/s3.config';
import { Image } from '../entities/image.entity';

@Resolver(() => Image)
export class ImageResolver {
  constructor(
    @Inject(s3Config.KEY)
    private readonly s3Configuration: ConfigType<typeof s3Config>,
  ) {}

  @ResolveField(() => String)
  url(@Parent() image: Image) {
    if (!image.url) return null;
    // Fallback if the database has full URLs from previous stages (e.g. seed data)
    if (image.url.startsWith('http')) return image.url;

    const bucket = this.s3Configuration.bucket;
    const region = this.s3Configuration.region;
    // We treat image.url as the stored S3 key
    return `https://${bucket}.s3.${region}.amazonaws.com/${image.url}`;
  }
}
