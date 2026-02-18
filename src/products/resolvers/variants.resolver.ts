import {
  Resolver,
  ResolveField,
  Parent,
  Mutation,
  Args,
  ID,
} from '@nestjs/graphql';
import { Variant, SelectedOption } from '../entities/variant.entity';
import { ProductRelationsService } from '../services/product-relations.service';
import { ProductVariantsService } from '../services/product-variants.service';
import { CreateVariantInput } from '../dto/create-variant.input';
import { UpdateVariantInput } from '../dto/update-variant.input';
import { ParseUUIDPipe } from '@nestjs/common';

@Resolver(() => Variant)
export class VariantsResolver {
  constructor(
    private readonly productRelationsService: ProductRelationsService,
    private readonly variantsService: ProductVariantsService,
  ) {}

  @Mutation(() => Variant)
  addProductVariant(
    @Args('id', { type: () => ID }, ParseUUIDPipe) productId: string,
    @Args('input') input: CreateVariantInput,
  ) {
    return this.variantsService.addVariant(productId, input);
  }

  @Mutation(() => Variant)
  updateProductVariant(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateVariantInput,
  ) {
    return this.variantsService.updateVariant(id, input);
  }

  @Mutation(() => Variant)
  deleteProductVariant(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
  ) {
    return this.variantsService.deleteVariant(id);
  }

  @ResolveField(() => [SelectedOption])
  selectedOptions(@Parent() variant: Variant) {
    return this.productRelationsService.getSelectedOptions(variant.id);
  }
}
