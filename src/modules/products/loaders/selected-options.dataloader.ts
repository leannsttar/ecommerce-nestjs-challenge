import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { SelectedOption } from '../entities/variants/selected-option.entity';

/**
 * Loads selected options for a batch of variant IDs in a single query.
 * Returns SelectedOption[] per variant (empty array if none).
 */
@Injectable({ scope: Scope.REQUEST })
export class SelectedOptionsDataLoader extends DataLoader<
  string,
  SelectedOption[]
> {
  constructor(private readonly prisma: PrismaService) {
    super((keys) => this.batchLoadFn(keys));
  }

  private async batchLoadFn(variantIds: readonly string[]) {
    const variantValues = await this.prisma.productVariantValue.findMany({
      where: { productVariantId: { in: [...variantIds] } },
      include: {
        productOptionValue: {
          include: { option: true },
        },
      },
    });

    const grouped = new Map<string, SelectedOption[]>();
    for (const vv of variantValues) {
      const selected: SelectedOption = {
        name: vv.productOptionValue.option.name,
        value: vv.productOptionValue.value,
      };
      const list = grouped.get(vv.productVariantId) ?? [];
      list.push(selected);
      grouped.set(vv.productVariantId, list);
    }

    return variantIds.map((id) => grouped.get(id) ?? []);
  }
}
