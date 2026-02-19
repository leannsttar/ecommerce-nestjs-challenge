import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { Image } from '../entities/image.entity';

/**
 * Loads all images for a batch of product IDs in a single query.
 * Returns Image[] per product (empty array if none).
 */
@Injectable({ scope: Scope.REQUEST })
export class ImagesDataLoader extends DataLoader<string, Image[]> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(productIds: readonly string[]) {
    const images = await this.prisma.productImage.findMany({
      where: { productId: { in: [...productIds] } },
    });

    const grouped = new Map<string, Image[]>();
    for (const image of images) {
      const list = grouped.get(image.productId) ?? [];
      list.push(image as unknown as Image);
      grouped.set(image.productId, list);
    }

    return productIds.map((id) => grouped.get(id) ?? []);
  }
}
