import {
  Resolver,
  Query,
  Args,
  ID,
  Int,
  ResolveField,
  Parent,
  Mutation,
} from '@nestjs/graphql';
import { UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { Product } from '../entities/product.entity';
import { PaginatedProducts } from '../entities/paginated-products.entity';
import { CreateProductInput } from '../dto/create-product.input';
import { UpdateProductInput } from '../dto/update-product.input';
import { AddImageInput } from '../dto/add-image.input';

import { Category } from '../../categories/entities/category.entity';
import { Image } from '../entities/image.entity';
import { ProductOption } from '../entities/product-option.entity';
import { Variant } from '../entities/variants/variant.entity';
import { Public } from 'src/modules/auth/decorators/public.decorator';

import { AbilitiesGuard } from '../../../common/casl/guards/abilities.guard';
import { CheckAbilities } from '../../../common/casl/decorators/check-abilities.decorator';
import { Action } from '../../../common/casl/casl-ability.factory';

import { CategoriesByProductDataLoader } from '../loaders/category.dataloader';
import { ImagesDataLoader } from '../loaders/images.dataloader';
import { FeaturedImageDataLoader } from '../loaders/featured-image.dataloader';
import { OptionsDataLoader } from '../loaders/options.dataloader';
import { VariantsDataLoader } from '../loaders/variants.dataloader';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesByProductDataLoader: CategoriesByProductDataLoader,
    private readonly imagesDataLoader: ImagesDataLoader,
    private readonly featuredImageDataLoader: FeaturedImageDataLoader,
    private readonly optionsDataLoader: OptionsDataLoader,
    private readonly variantsDataLoader: VariantsDataLoader,
  ) {}

  // Public Queries

  @Public()
  @Query(() => PaginatedProducts, { name: 'products' })
  findAll(
    @Args('limit', { type: () => Int, defaultValue: 15 }) limit: number,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('categoryId', { type: () => ID, nullable: true })
    categoryId?: string,
  ) {
    return this.productsService.findAll(limit, page, categoryId);
  }

  @Public()
  @Query(() => Product, { name: 'product', nullable: true })
  findOne(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  // ─── Manager-Only Mutations ───────────────────────────────────────────────────

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Create, subject: Product })
  @Mutation(() => Product)
  createProduct(@Args('input') input: CreateProductInput) {
    return this.productsService.create(input);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Product })
  @Mutation(() => Product)
  updateProduct(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateProductInput,
  ) {
    return this.productsService.update(id, input);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Delete, subject: Product })
  @Mutation(() => Product)
  deleteProduct(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Product })
  @Mutation(() => Product)
  disableProduct(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.disable(id);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Product })
  @Mutation(() => Product)
  enableProduct(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.productsService.enable(id);
  }

  // Image Mutations (Manager only)

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Product })
  @Mutation(() => Image)
  addProductImage(
    @Args('productId', { type: () => ID }, ParseUUIDPipe) productId: string,
    @Args('input') input: AddImageInput,
  ) {
    return this.productsService.addProductImage(productId, input);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Product })
  @Mutation(() => Image)
  deleteProductImage(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
  ) {
    return this.productsService.deleteProductImage(id);
  }

  // ─── Field Resolvers ──────────────────────────────────────────────────────────

  @ResolveField(() => [Category])
  categories(@Parent() product: Product) {
    return this.categoriesByProductDataLoader.load(product['id']);
  }

  @ResolveField(() => [Image])
  images(@Parent() product: Product) {
    return this.imagesDataLoader.load(product['id']);
  }

  @ResolveField(() => Image, { nullable: true })
  featuredImage(@Parent() product: Product) {
    return this.featuredImageDataLoader.load(product['id']);
  }

  @ResolveField(() => [ProductOption])
  options(@Parent() product: Product) {
    return this.optionsDataLoader.load(product['id']);
  }

  @ResolveField(() => [Variant])
  variants(@Parent() product: Product) {
    return this.variantsDataLoader.load(product['id']);
  }
}
