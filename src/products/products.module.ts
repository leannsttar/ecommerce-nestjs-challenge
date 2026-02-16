import { Module } from '@nestjs/common';
import { ProductsResolver } from './products.resolver';
import { ProductAdminResolver } from './products-admin.resolver';
import { ProductsService } from './products.service';
import { CategoryDataLoader } from './loaders/category.dataloader';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [CategoriesModule],
  providers: [
    ProductsResolver,
    ProductAdminResolver,
    ProductsService,
    CategoryDataLoader,
  ],
})
export class ProductsModule {}
