import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class IsFavoriteDataLoader extends DataLoader<string, boolean> {
  private userId: string | null = null;

  constructor(private readonly prisma: PrismaService) {
    super((variantIds) => this.batchLoadFn(variantIds));
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  private async batchLoadFn(variantIds: readonly string[]): Promise<boolean[]> {
    if (!this.userId) {
      // unauthenticated: nothing is favorited
      return variantIds.map(() => false);
    }

    const favorites = await this.prisma.favorite.findMany({
      where: { userId: this.userId, variantId: { in: [...variantIds] } },
      select: { variantId: true },
    });

    const favoritedIds = new Set(favorites.map((f) => f.variantId));

    return variantIds.map((id) => favoritedIds.has(id));
  }
}
