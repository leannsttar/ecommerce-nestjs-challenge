import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { Category } from '../../categories/entities/category.entity';

/**
 * Loads categories for a batch of product IDs in a single query.
 * Handles the M:N relationship via the ProductCategory join table.
 * Returns Category[] per product (empty array if none).
 */
@Injectable({ scope: Scope.REQUEST })
export class CategoriesByProductDataLoader extends DataLoader<
  string,
  Category[]
> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(productIds: readonly string[]) {
    const productCategories = await this.prisma.productCategory.findMany({
      where: { productId: { in: [...productIds] } },
      include: { category: true },
    });

    // Group categories by productId
    const grouped = new Map<string, Category[]>();
    for (const pc of productCategories) {
      const list = grouped.get(pc.productId) ?? [];
      list.push(pc.category as unknown as Category);
      grouped.set(pc.productId, list);
    }

    return productIds.map((id) => grouped.get(id) ?? []);
  }
}
