import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AbilitiesGuard } from '../../common/casl/guards/abilities.guard';
import { CheckAbilities } from '../../common/casl/decorators/check-abilities.decorator';
import { Action } from '../../common/casl/casl-ability.factory';

@Resolver(() => Favorite)
export class FavoritesResolver {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Query(() => [Favorite], { name: 'myFavorites' })
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Read, subject: Favorite })
  myFavorites(@CurrentUser() user: { id: string }) {
    return this.favoritesService.findAllForUser(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Manage, subject: Favorite })
  toggleFavorite(
    @CurrentUser() user: { id: string },
    @Args('variantId', { type: () => ID }, ParseUUIDPipe) variantId: string,
  ): Promise<boolean> {
    return this.favoritesService.toggle(user.id, variantId);
  }
}
