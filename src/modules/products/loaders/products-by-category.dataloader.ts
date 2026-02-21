import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { Product } from '../entities/product.entity';

/**
 * Loads products for a batch of category IDs in a single query.
 * Handles the M:N relationship via the ProductCategory join table.
 * Returns Product[] per category (empty array if none).
 */
@Injectable({ scope: Scope.REQUEST })
export class ProductsByCategoryDataLoader extends DataLoader<
  string,
  Product[]
> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(categoryIds: readonly string[]) {
    const productCategories = await this.prisma.productCategory.findMany({
      where: { categoryId: { in: [...categoryIds] } },
      include: { product: true },
    });

    const grouped = new Map<string, Product[]>();
    for (const pc of productCategories) {
      const list = grouped.get(pc.categoryId) ?? [];
      list.push(pc.product as unknown as Product);
      grouped.set(pc.categoryId, list);
    }

    return categoryIds.map((id) => grouped.get(id) ?? []);
  }
}
