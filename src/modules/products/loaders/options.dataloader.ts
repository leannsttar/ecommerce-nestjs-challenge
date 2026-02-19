import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductOption } from '../entities/product-option.entity';

/**
 * Loads all options (with values) for a batch of product IDs in a single query.
 * Returns ProductOption[] per product (empty array if none).
 */
@Injectable({ scope: Scope.REQUEST })
export class OptionsDataLoader extends DataLoader<string, ProductOption[]> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(productIds: readonly string[]) {
    const options = await this.prisma.productOption.findMany({
      where: { productId: { in: [...productIds] } },
      include: { values: true },
    });

    const grouped = new Map<string, ProductOption[]>();
    for (const option of options) {
      const mapped: ProductOption = {
        id: option.id,
        name: option.name,
        values: option.values.map((v) => v.value),
      };
      const list = grouped.get(option.productId) ?? [];
      list.push(mapped);
      grouped.set(option.productId, list);
    }

    return productIds.map((id) => grouped.get(id) ?? []);
  }
}
