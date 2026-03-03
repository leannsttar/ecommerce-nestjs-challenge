import { Module, forwardRef } from '@nestjs/common';
import { CategoriesResolver } from './categories.resolver';
import { CategoriesService } from './categories.service';
import { CategoriesByProductDataLoader } from './loaders/categories-by-product.dataloader';
import { CaslModule } from 'src/common/casl/casl.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [CaslModule, forwardRef(() => ProductsModule)],
  providers: [
    CategoriesResolver,
    CategoriesService,
    CategoriesByProductDataLoader,
  ],
  exports: [CategoriesService, CategoriesByProductDataLoader],
})
export class CategoriesModule {}
