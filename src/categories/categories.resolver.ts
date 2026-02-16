import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
// TODO: Import CaslGuard when implemented

@Resolver(() => Category)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Query(() => [Category], { name: 'categories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Query(() => Category, { name: 'category', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Mutation(() => Category)
  //@UseGuards(CaslGuard when implemented)
  createCategory(@Args('input') input: CreateCategoryInput) {
    return this.categoriesService.create(input);
  }

  @Mutation(() => Category)
  //@UseGuards(CaslGuard when implemented)
  updateCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCategoryInput,
  ) {
    return this.categoriesService.update(id, input);
  }

  @Mutation(() => ID)
  //@UseGuards(CaslGuard when implemented)
  deleteCategory(@Args('id', { type: () => ID }) id: string) {
    return this.categoriesService.remove(id);
  }
}
