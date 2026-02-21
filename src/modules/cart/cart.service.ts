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
      id: userId,
      items,
      totalQuantity,
      subtotal,
    };
  }

  //If the variant already exists in the cart, increments the quantity

  async addItem(userId: string, input: AddToCartInput) {
    const { variantId, quantity } = input;

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

  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    input: UpdateCartItemInput,
  ) {
    const { count } = await this.prisma.cartItem.updateMany({
      where: { id: cartItemId, userId },
      data: { quantity: input.quantity },
    });

    if (count === 0) {
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
