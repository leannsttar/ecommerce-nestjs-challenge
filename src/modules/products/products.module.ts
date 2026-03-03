import { Module, forwardRef } from '@nestjs/common';
import { ProductsResolver } from './resolvers/products.resolver';
import { VariantsResolver } from './resolvers/variants.resolver';
import { ImageResolver } from './resolvers/image.resolver';
import { ProductsService } from './services/products.service';
import { ProductVariantsService } from './services/product-variants.service';
import { CategoriesModule } from '../categories/categories.module';
import { CaslModule } from '../../common/casl/casl.module';
import { ProductsByCategoryDataLoader } from './loaders/products-by-category.dataloader';
import { ImagesDataLoader } from './loaders/images.dataloader';
import { FeaturedImageDataLoader } from './loaders/featured-image.dataloader';
import { OptionsDataLoader } from './loaders/options.dataloader';
import { VariantsDataLoader } from './loaders/variants.dataloader';
import { SelectedOptionsDataLoader } from './loaders/selected-options.dataloader';
import { FavoritesModule } from '../favorites/favorites.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [
    forwardRef(() => CategoriesModule),
    CaslModule,
    FavoritesModule,
    StripeModule,
  ],
  providers: [
    ProductsResolver,
    VariantsResolver,
    ImageResolver,
    ProductsService,
    ProductVariantsService,
    ProductsByCategoryDataLoader,
    ImagesDataLoader,
    FeaturedImageDataLoader,
    OptionsDataLoader,
    VariantsDataLoader,
    SelectedOptionsDataLoader,
  ],
  exports: [
    ProductsService,
    ProductVariantsService,
    ProductsByCategoryDataLoader,
  ],
})
export class ProductsModule {}
