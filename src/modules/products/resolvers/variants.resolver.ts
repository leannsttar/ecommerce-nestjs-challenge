import {
  Resolver,
  ResolveField,
  Parent,
  Mutation,
  Args,
  ID,
  Context,
} from '@nestjs/graphql';
import { Variant } from '../entities/variants/variant.entity';
import { SelectedOption } from '../entities/variants/selected-option.entity';
import { ProductVariantsService } from '../services/product-variants.service';
import { CreateVariantInput } from '../dto/variants/create-variant.input';
import { UpdateVariantInput } from '../dto/variants/update-variant.input';
import { ParseUUIDPipe, UseGuards, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { s3Config } from '../../../common/config/namespaces/s3.config';
import { AbilitiesGuard } from 'src/common/casl/guards/abilities.guard';
import { CheckAbilities } from 'src/common/casl/decorators/check-abilities.decorator';
import { Action } from 'src/common/casl/casl-ability.factory';
import { SelectedOptionsDataLoader } from '../loaders/selected-options.dataloader';
import { IsFavoriteDataLoader } from '../../favorites/loaders/is-favorite.dataloader';

@Resolver(() => Variant)
export class VariantsResolver {
  constructor(
    private readonly variantsService: ProductVariantsService,
    private readonly selectedOptionsDataLoader: SelectedOptionsDataLoader,
    private readonly isFavoriteDataLoader: IsFavoriteDataLoader,
    @Inject(s3Config.KEY)
    private readonly s3Configuration: ConfigType<typeof s3Config>,
  ) {}

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Create, subject: Variant })
  @Mutation(() => Variant)
  addProductVariant(
    @Args('id', { type: () => ID }, ParseUUIDPipe) productId: string,
    @Args('input') input: CreateVariantInput,
  ) {
    return this.variantsService.addVariant(productId, input);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: Variant })
  @Mutation(() => Variant)
  updateProductVariant(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateVariantInput,
  ) {
    return this.variantsService.updateVariant(id, input);
  }

  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Delete, subject: Variant })
  @Mutation(() => Variant)
  deleteProductVariant(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
  ) {
    return this.variantsService.deleteVariant(id);
  }

  @ResolveField(() => [SelectedOption])
  selectedOptions(@Parent() variant: Variant) {
    return this.selectedOptionsDataLoader.load(variant.id);
  }

  @ResolveField(() => String, { nullable: true })
  image(@Parent() variant: Variant) {
    if (!variant.image) return null;
    if (variant.image.startsWith('http')) return variant.image;

    const bucket = this.s3Configuration.bucket;
    const region = this.s3Configuration.region;
    return `https://${bucket}.s3.${region}.amazonaws.com/${variant.image}`;
  }

  //for unauthenticated requests returns false
  @ResolveField(() => Boolean)
  isFavorite(
    @Parent() variant: Variant,
    @Context() context: { req: { user?: { id: string } } },
  ): Promise<boolean> {
    const userId = context.req.user?.id;
    if (userId) {
      this.isFavoriteDataLoader.setUserId(userId);
    }
    return this.isFavoriteDataLoader.load(variant.id);
  }
}
