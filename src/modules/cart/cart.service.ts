import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddToCartInput } from './dto/add-to-cart.input';
import { UpdateCartItemInput } from './dto/update-cart-item.input';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a Cart object from the user's CartItems.
   * The Cart is a virtual aggregate — there is no cart table in the DB.
   */
  async getCart(userId: string) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { productVariant: true },
      orderBy: { createdAt: 'asc' },
    });

    const items = cartItems.map((item) => ({
      ...item,
      subtotal: item.quantity * item.productVariant.price,
    }));

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);

    return {
      id: userId, // Cart ID is the user ID (virtual entity)
      items,
      totalQuantity,
      subtotal,
    };
  }

  //If the variant already exists in the cart, increments the quantity

  async addItem(userId: string, input: AddToCartInput) {
    const { variantId, quantity } = input;

    //ensure it's buyable (active/not deleted)
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null, isActive: true },
    });
    if (!variant) {
      throw new NotFoundException(
        `Product variant with ID ${variantId} not found or unavailable`,
      );
    }

    await this.prisma.cartItem.upsert({
      where: {
        userId_productVariantId: { userId, productVariantId: variantId },
      },
      update: { quantity: { increment: quantity } },
      create: { userId, productVariantId: variantId, quantity },
    });

    return this.getCart(userId);
  }

  //Update the quantity of an existing cart item.
  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    input: UpdateCartItemInput,
  ) {
    // Use updateMany to handle ownership check in the query itself.
    // If mismatch, count will be 0.
    // Alternatively, try/catch around update with composite ID?
    // But schema only has ID as primary key.
    // We can use updateMany which returns count.

    const { count } = await this.prisma.cartItem.updateMany({
      where: { id: cartItemId, userId },
      data: { quantity: input.quantity },
    });

    if (count === 0) {
      // Could be not found OR not owned.
      // To be strictly correct with HTTP limits we might want 404 vs 403,
      // but usually 404 is safer (hide existence).
      throw new NotFoundException(`Cart item not found`);
    }

    return this.getCart(userId);
  }

  async removeItem(userId: string, cartItemId: string) {
    const { count } = await this.prisma.cartItem.deleteMany({
      where: { id: cartItemId, userId },
    });

    if (count === 0) {
      throw new NotFoundException(`Cart item not found`);
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    });

    return this.getCart(userId);
  }
}
