import { Module } from '@nestjs/common';
import { ProductsResolver } from './resolvers/products.resolver';
import { VariantsResolver } from './resolvers/variants.resolver';
import { ProductsService } from './services/products.service';
import { ProductVariantsService } from './services/product-variants.service';
import { ProductRelationsService } from './services/product-relations.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [CategoriesModule],
  providers: [
    ProductsResolver,
    VariantsResolver,
    ProductsService,
    ProductVariantsService,
    ProductRelationsService,
  ],
  exports: [ProductsService, ProductVariantsService, ProductRelationsService],
})
export class ProductsModule {}
