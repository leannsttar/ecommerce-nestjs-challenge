import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { ParseUUIDPipe } from '@nestjs/common';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddToCartInput } from './dto/add-to-cart.input';
import { UpdateCartItemInput } from './dto/update-cart-item.input';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Variant } from '../products/entities/variants/variant.entity';

@Resolver(() => CartItem)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  // ─── Queries ──────────────────────────────────────────────────────────────────

  @Query(() => Cart, { name: 'myCart' })
  myCart(@CurrentUser() user: { id: string }) {
    return this.cartService.getCart(user.id);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────────

  @Mutation(() => Cart)
  addItemToCart(
    @CurrentUser() user: { id: string },
    @Args('input') input: AddToCartInput,
  ) {
    return this.cartService.addItem(user.id, input);
  }

  @Mutation(() => Cart)
  updateCartItemQuantity(
    @CurrentUser() user: { id: string },
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateCartItemInput,
  ) {
    return this.cartService.updateItemQuantity(user.id, id, input);
  }

  @Mutation(() => Cart)
  removeItemFromCart(
    @CurrentUser() user: { id: string },
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
  ) {
    return this.cartService.removeItem(user.id, id);
  }

  @Mutation(() => Cart)
  clearCart(@CurrentUser() user: { id: string }) {
    return this.cartService.clearCart(user.id);
  }

  // ─── Field Resolvers ──────────────────────────────────────────────────────────

  @ResolveField(() => Variant)
  variant(@Parent() cartItem: CartItem & { productVariant?: Variant }) {
    return cartItem.productVariant ?? cartItem.variant;
  }
}
