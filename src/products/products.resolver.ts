import {
  Resolver,
  Query,
  Args,
  ID,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

import { CategoryDataLoader } from './loaders/category.dataloader';
import { Category } from '../categories/entities/category.entity';
import { Image } from './entities/image.entity';
import { Public } from 'src/auth/decorators/public.decorator';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoryLoader: CategoryDataLoader,
  ) {}

  @Public()
  @Query(() => [Product], { name: 'products' })
  findAll() {
    return this.productsService.findAll();
  }

  @Public()
  @Query(() => Product, { name: 'product', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.productsService.findOne(id);
  }

  @ResolveField(() => Category)
  category(@Parent() product: Product) {
    return this.categoryLoader.load(product['categoryId']);
  }

  @ResolveField(() => [Image])
  images(@Parent() product: Product) {
    return this.productsService.getImages(product['id']);
  }

  @ResolveField(() => Image, { nullable: true })
  featuredImage(@Parent() product: Product) {
    return this.productsService.getFeaturedImage(product['id']);
  }
}
