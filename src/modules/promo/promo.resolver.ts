import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PromoService } from './promo.service';
import { PromoCode } from './entities/promo-code.entity';
import { CreatePromoCodeInput } from './dto/create-promo-code.input';
import { UpdatePromoCodeInput } from './dto/update-promo-code.input';
import { AbilitiesGuard } from 'src/common/casl/guards/abilities.guard';
import { CheckAbilities } from 'src/common/casl/decorators/check-abilities.decorator';
import { Action } from 'src/common/casl/casl-ability.factory';
import { ParseUUIDPipe } from '@nestjs/common';

@Resolver(() => PromoCode)
export class PromoResolver {
  constructor(private readonly promoService: PromoService) {}

  @Query(() => [PromoCode], { name: 'promoCodes' })
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Read, subject: PromoCode })
  findAll() {
    return this.promoService.findAll();
  }

  @Mutation(() => PromoCode)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Create, subject: PromoCode })
  createPromoCode(@Args('input') input: CreatePromoCodeInput) {
    return this.promoService.create(input);
  }

  @Mutation(() => PromoCode)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: PromoCode })
  updatePromoCode(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdatePromoCodeInput,
  ) {
    return this.promoService.update(id, input);
  }

  @Mutation(() => PromoCode)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: PromoCode })
  disablePromoCode(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.promoService.disable(id);
  }

  @Mutation(() => PromoCode)
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Update, subject: PromoCode })
  enablePromoCode(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.promoService.enable(id);
  }
}
