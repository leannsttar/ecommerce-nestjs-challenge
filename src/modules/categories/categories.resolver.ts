import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { Public } from '../auth/decorators/public.decorator';
import { Product } from '../products/entities/product.entity';
import { ProductsByCategoryDataLoader } from '../products/loaders/products-by-category.dataloader';
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AbilitiesGuard } from 'src/common/casl/guards/abilities.guard';
import { CheckAbilities } from 'src/common/casl/decorators/check-abilities.decorator';
import { Action } from 'src/common/casl/casl-ability.factory';

@Resolver(() => Category)
export class CategoriesResolver {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly productsByCategoryDataLoader: ProductsByCategoryDataLoader,
  ) {}

  @Public()
  @Query(() => [Category], { name: 'categories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Mutation(() => Category)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Create, subject: Category })
  createCategory(@Args('input') input: CreateCategoryInput) {
    return this.categoriesService.create(input);
  }

  @Mutation(() => Category)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Category })
  updateCategory(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateCategoryInput,
  ) {
    return this.categoriesService.update(id, input);
  }

  @Mutation(() => Category)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Delete, subject: Category })
  deleteCategory(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }

  @ResolveField(() => [Product])
  products(@Parent() category: Category) {
    return this.productsByCategoryDataLoader.load(category.id);
  }
}
