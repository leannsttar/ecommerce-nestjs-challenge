import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { Image } from '../entities/image.entity';

/**
 * Loads the featured (main) image for a batch of product IDs.
 * Returns Image | null per product.
 */
@Injectable({ scope: Scope.REQUEST })
export class FeaturedImageDataLoader extends DataLoader<string, Image | null> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(productIds: readonly string[]) {
    const featuredImages = await this.prisma.productImage.findMany({
      where: { productId: { in: [...productIds] }, isMain: true },
    });

    const imageMap = new Map<string, Image>();
    for (const image of featuredImages) {
      imageMap.set(image.productId, image as unknown as Image);
    }

    return productIds.map((id) => imageMap.get(id) ?? null);
  }
}
