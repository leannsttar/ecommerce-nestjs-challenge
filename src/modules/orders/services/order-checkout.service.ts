import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import { CheckoutInput } from '../dto/checkout.input';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../entities/order.entity';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrderCheckoutService {
  private readonly logger = new Logger(OrderCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    @InjectQueue('stock-notifications') private readonly stockQueue: Queue,
  ) {}

  async checkout(userId: string, input: CheckoutInput) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        productVariant: {
          include: { product: true },
        },
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException(
        'Your cart is empty. Add items before checking out.',
      );
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.productVariant.price * item.quantity,
      0,
    );

    let discountAmount = 0;
    let promoCodeId: string | null = null;
    let promoSnapshot: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      Prisma.JsonNull;

    if (input.promoCode) {
      const code = input.promoCode;
      const promo = await this.prisma.promoCode.findUnique({
        where: { code },
      });

      if (!promo)
        throw new NotFoundException(`Promo code "${code}" does not exist.`);
      if (!promo.isActive)
        throw new UnprocessableEntityException(
          `Promo code "${code}" is currently inactive.`,
        );
      if (new Date() > promo.expiresAt)
        throw new UnprocessableEntityException(
          `Promo code "${code}" has expired.`,
        );
      if (promo.usageCount >= promo.usageLimit)
        throw new UnprocessableEntityException(
          `Promo code "${code}" has reached its usage limit.`,
        );
      if (promo.minPurchase && subtotal < promo.minPurchase) {
        const minDollars = (promo.minPurchase / 100).toFixed(2);
        throw new UnprocessableEntityException(
          `This promo code requires a minimum purchase of $${minDollars}.`,
        );
      }

      if (promo.type === 'PERCENTAGE') {
        discountAmount = Math.floor((subtotal * promo.value) / 100);
        if (promo.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, promo.maxDiscountAmount);
        }
      } else {
        discountAmount = promo.value;
      }
      discountAmount = Math.min(discountAmount, subtotal);

      promoCodeId = promo.id;
      promoSnapshot = {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        maxDiscountAmount: promo.maxDiscountAmount,
        discountApplied: discountAmount,
      };
    }

    const totalAmount = subtotal - discountAmount;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.createPaymentIntent({
        amount: totalAmount,
        currency: input.currency ?? 'usd',
        userId,
        stripeCustomerId: user?.stripeCustomerId ?? undefined,
      });
    } catch (err) {
      this.logger.error(`Stripe PaymentIntent creation failed: ${err.message}`);
      throw new InternalServerErrorException(
        'Payment provider error. Please try again.',
      );
    }

    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const variantIds = cartItems.map((i) => i.productVariantId);
        const freshVariants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, stockQuantity: true, sku: true },
        });
        const stockMap = new Map(freshVariants.map((v) => [v.id, v]));

        const outOfStock = cartItems.filter(
          (item) =>
            item.quantity >
            (stockMap.get(item.productVariantId)?.stockQuantity ?? 0),
        );
        if (outOfStock.length > 0) {
          const skus = outOfStock
            .map(
              (i) =>
                stockMap.get(i.productVariantId)?.sku ?? i.productVariantId,
            )
            .join(', ');
          throw new UnprocessableEntityException(
            `Insufficient stock for variant(s): ${skus}`,
          );
        }

        const { addressLine, city, country, postalCode } = input.shippingAddress;

        const newOrder = await tx.order.create({
          data: {
            userId,
            status: OrderStatus.PENDING,
            shippingAddressSnapshot: { addressLine, city, country, postalCode },
            subtotal,
            discountAmount,
            totalAmount,
            promoCodeId,
            promoSnapshot,
            items: {
              create: cartItems.map((item) => ({
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                unitPriceAtPurchase: item.productVariant.price,
                totalPrice: item.productVariant.price * item.quantity,
                productSnapshot: {
                  productName: item.productVariant.product.name,
                  sku: item.productVariant.sku,
                  price: item.productVariant.price,
                },
              })),
            },
          },
          include: { items: true },
        });

        for (const item of cartItems) {
          const updatedVariant = await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });

          if (updatedVariant.stockQuantity === 3) {
            await this.stockQueue.add('notify', {
              variantId: updatedVariant.id,
            });
          }
        }

        if (promoCodeId) {
          await tx.promoCode.update({
            where: { id: promoCodeId },
            data: { usageCount: { increment: 1 } },
          });
        }

        await tx.cartItem.deleteMany({ where: { userId } });

        return newOrder;
      });
    } catch (err) {
      this.stripe.cancelPaymentIntent(paymentIntent.id).catch((cancelErr) => {
        this.logger.error(
          `Failed to cancel PI ${paymentIntent.id} after DB error: ${cancelErr.message}`,
        );
      });
      throw err;
    }

    this.stripe
      .updatePaymentIntentMetadata(paymentIntent.id, order.id)
      .catch((err) => {
        this.logger.warn(
          `Could not update PI metadata for ${paymentIntent.id}: ${err.message}`,
        );
      });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: PaymentMethod.PAYMENT_INTENT,
        status: PaymentStatus.PENDING,
        currency: input.currency ?? 'usd',
        amount: totalAmount,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      amount: totalAmount,
    };
  }
}
