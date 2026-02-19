import { Module } from '@nestjs/common';
import { CategoriesResolver } from './categories.resolver';
import { CategoriesService } from './categories.service';
import { ProductsByCategoryDataLoader } from '../products/loaders/products-by-category.dataloader';
import { CaslModule } from 'src/common/casl/casl.module';

@Module({
  imports: [CaslModule],
  providers: [
    CategoriesResolver,
    CategoriesService,
    ProductsByCategoryDataLoader,
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
