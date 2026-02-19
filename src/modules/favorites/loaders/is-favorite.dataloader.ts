import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { FavoritesService } from '../favorites.service';

@Injectable({ scope: Scope.REQUEST })
export class IsFavoriteDataLoader extends DataLoader<string, boolean> {
  private userId: string | null = null;

  constructor(private readonly favoritesService: FavoritesService) {
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

    const favoritedIds = await this.favoritesService.getFavoritedVariantIds(
      this.userId,
      variantIds,
    );

    return variantIds.map((id) => favoritedIds.has(id));
  }
}
