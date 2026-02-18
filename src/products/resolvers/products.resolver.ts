import {
  Resolver,
  Query,
  Args,
  ID,
  ResolveField,
  Parent,
  Mutation,
} from '@nestjs/graphql';
import { ProductsService } from '../services/products.service';
import { Product } from '../entities/product.entity';
import { CreateProductInput } from '../dto/create-product.input';
import { UpdateProductInput } from '../dto/update-product.input';

import { Category } from '../../categories/entities/category.entity';
import { Image } from '../entities/image.entity';
import { ProductOption } from '../entities/product-option.entity';
import { Variant } from '../entities/variant.entity';
import { Public } from 'src/auth/decorators/public.decorator';

import { ProductRelationsService } from '../services/product-relations.service';
import { ParseUUIDPipe } from '@nestjs/common';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,

    private readonly productRelationsService: ProductRelationsService,
  ) {}

  @Public()
  @Query(() => [Product], { name: 'products' })
  findAll() {
    return this.productsService.findAll();
  }

  @Public()
  @Query(() => Product, { name: 'product', nullable: true })
  findOne(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  // MUTATIONS

  @Mutation(() => Product)
  createProduct(@Args('input') input: CreateProductInput) {
    return this.productsService.create(input);
  }

  @Mutation(() => Product)
  updateProduct(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateProductInput,
  ) {
    return this.productsService.update(id, input);
  }

  @Mutation(() => Product)
  deleteProduct(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Mutation(() => Product)
  disableProduct(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.disable(id);
  }

  @Mutation(() => Product)
  enableProduct(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.enable(id);
  }

  // IMAGE MUTATIONS

  // @Mutation(() => Image)
  // addProductImage(
  //   @Args('productId', { type: () => ID }) productId: string,
  //   @Args('imageKey') imageKey: string,
  // ) {
  //   return this.productsService.addProductImage(productId, imageKey);
  // }

  // @Mutation(() => Image)
  // deleteProductImage(@Args('id', { type: () => ID }) id: string) {
  //   return this.productsService.deleteProductImage(id);
  // }

  // FIELD RESOLVERE

  @ResolveField(() => [Category])
  categories(@Parent() product: Product) {
    return this.productRelationsService.getCategories(product['id']);
  }

  @ResolveField(() => [Image])
  images(@Parent() product: Product) {
    return this.productRelationsService.getImages(product['id']);
  }

  @ResolveField(() => Image, { nullable: true })
  featuredImage(@Parent() product: Product) {
    return this.productRelationsService.getFeaturedImage(product['id']);
  }

  @ResolveField(() => [ProductOption])
  options(@Parent() product: Product) {
    return this.productRelationsService.getOptions(product['id']);
  }

  @ResolveField(() => [Variant])
  variants(@Parent() product: Product) {
    return this.productRelationsService.getVariants(product['id']);
  }
}
