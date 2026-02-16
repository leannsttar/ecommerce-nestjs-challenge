import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { ProductsService } from './products.service';
import { ProductAdmin } from './entities/product-admin.entity';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { CategoryDataLoader } from './loaders/category.dataloader';
import { Category } from '../categories/entities/category.entity';
import { Image } from './entities/image.entity';

/**
 * TODO: Add CASL authorization guards to restrict access to MANAGER role.
 */
@Resolver(() => ProductAdmin)
export class ProductAdminResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoryLoader: CategoryDataLoader,
  ) {}

  // QUERIES (Manager-only)

  @Query(() => [ProductAdmin], { name: 'allProducts' })
  findAllManager() {
    return this.productsService.findAllManager();
  }

  @Query(() => ProductAdmin, { name: 'productManager', nullable: true })
  findOneManager(@Args('id', { type: () => ID }) id: string) {
    return this.productsService.findOneManager(id);
  }

  // MUTATIONS (Manager-only)

  @Mutation(() => ProductAdmin)
  createProduct(@Args('input') input: CreateProductInput) {
    return this.productsService.create(input);
  }

  @Mutation(() => ProductAdmin)
  updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProductInput,
  ) {
    return this.productsService.update(id, input);
  }

  @Mutation(() => ID)
  deleteProduct(@Args('id', { type: () => ID }) id: string) {
    return this.productsService.remove(id);
  }

  @Mutation(() => ProductAdmin)
  disableProduct(@Args('id', { type: () => ID }) id: string) {
    return this.productsService.disable(id);
  }

  @Mutation(() => ProductAdmin)
  enableProduct(@Args('id', { type: () => ID }) id: string) {
    return this.productsService.enable(id);
  }

  // FIELD RESOLVERS

  @ResolveField(() => Category)
  category(@Parent() product: ProductAdmin) {
    return this.categoryLoader.load(product['categoryId']);
  }

  @ResolveField(() => [Image])
  images(@Parent() product: ProductAdmin) {
    return this.productsService.getImages(product['id']);
  }

  @ResolveField(() => Image, { nullable: true })
  featuredImage(@Parent() product: ProductAdmin) {
    return this.productsService.getFeaturedImage(product['id']);
  }
}
