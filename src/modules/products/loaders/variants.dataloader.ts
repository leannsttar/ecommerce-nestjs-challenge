import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { Variant } from '../entities/variants/variant.entity';

/**
 * Loads all non-deleted variants for a batch of product IDs in a single query.
 * Returns Variant[] per product (empty array if none).
 */
@Injectable({ scope: Scope.REQUEST })
export class VariantsDataLoader extends DataLoader<string, Variant[]> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(productIds: readonly string[]) {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId: { in: [...productIds] }, deletedAt: null },
    });

    const grouped = new Map<string, Variant[]>();
    for (const variant of variants) {
      const list = grouped.get(variant.productId) ?? [];
      list.push(variant as unknown as Variant);
      grouped.set(variant.productId, list);
    }

    return productIds.map((id) => grouped.get(id) ?? []);
  }
}
