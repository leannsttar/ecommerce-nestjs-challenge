import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesResolver } from './favorites.resolver';
import { IsFavoriteDataLoader } from './loaders/is-favorite.dataloader';
import { CaslModule } from '../../common/casl/casl.module';

@Module({
  imports: [CaslModule],
  providers: [FavoritesResolver, FavoritesService, IsFavoriteDataLoader],
  exports: [FavoritesService, IsFavoriteDataLoader],
})
export class FavoritesModule {}
