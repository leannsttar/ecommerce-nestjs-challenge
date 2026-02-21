import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CheckoutInput } from './dto/checkout.input';
import { OrderFilterInput } from './dto/order-filter.input';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './entities/order.entity';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
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

    // ──────────────────────────────────────────────────────────────────────────
    // PROMO CODE VALIDATION & DISCOUNT CALCULATION
    // ──────────────────────────────────────────────────────────────────────────
    let discountAmount = 0;
    let promoCodeId: string | null = null;

    let promoSnapshot: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      Prisma.JsonNull;

    if (input.promoCode) {
      const code = input.promoCode.toUpperCase();
      const promo = await this.prisma.promoCode.findUnique({
        where: { code },
      });

      if (!promo) {
        throw new BadRequestException(`Promo code "${code}" does not exist.`);
      }

      if (!promo.isActive) {
        throw new BadRequestException(
          `Promo code "${code}" is currently inactive.`,
        );
      }

      if (new Date() > promo.expiresAt) {
        throw new BadRequestException(`Promo code "${code}" has expired.`);
      }

      if (promo.usageCount >= promo.usageLimit) {
        throw new BadRequestException(
          `Promo code "${code}" has reached its usage limit.`,
        );
      }

      if (promo.minPurchase && subtotal < promo.minPurchase) {
        const minDollars = (promo.minPurchase / 100).toFixed(2);
        throw new BadRequestException(
          `This promo code requires a minimum purchase of $${minDollars}.`,
        );
      }

      // ── Calculate Discount ──────────────────────────────────────────────────
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
    // ──────────────────────────────────────────────────────────────────────────

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

    let order: Awaited<ReturnType<typeof this.prisma.order.create>>;
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
          throw new BadRequestException(
            `Insufficient stock for variant(s): ${skus}`,
          );
        }

        const newOrder = await tx.order.create({
          data: {
            userId,
            status: OrderStatus.PENDING,
            shippingAddressSnapshot: { ...input.shippingAddress },
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
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }

        // Increment usage count atomically inside the transaction
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

  // ─────────────────────────────────────────────────
  // WEBHOOKS
  // ─────────────────────────────────────────────────

  async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(
        `payment_intent.succeeded: No orderId in metadata for PI ${paymentIntent.id}`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PAID },
      });

      if (count === 0) {
        this.logger.log(
          `Order ${orderId} was not in PENDING state. Skipping webhook (already processed or canceled).`,
        );
        return;
      }

      await tx.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paymentDate: new Date(),
        },
      });
    });

    this.logger.log(`Order ${orderId} marked as PAID via PaymentIntent.`);
  }

  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    this.logger.warn(
      `Payment failed for order ${orderId}. PI: ${paymentIntent.id}`,
    );

    await this.prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const fullSession = (await this.stripe.retrieveCheckoutSession(
      session.id,
    )) as Stripe.Checkout.Session & {
      shipping_details?: {
        address: Stripe.Address | null;
        name: string;
      } | null;
    };

    // Idempotency check: if we've already processed this session, skip
    const existing = await this.prisma.payment.findFirst({
      where: { stripeSessionId: fullSession.id },
    });
    if (existing) {
      this.logger.log(`Session ${fullSession.id} already processed. Skipping.`);
      return;
    }

    const variantId = fullSession.metadata?.variantId;
    if (!variantId) {
      this.logger.warn(
        `checkout.session.completed: No variantId in metadata for session ${fullSession.id}`,
      );
      return;
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      this.logger.warn(
        `Variant ${variantId} not found for session ${fullSession.id}`,
      );
      return;
    }

    const quantity = fullSession.line_items?.data?.[0]?.quantity ?? 1;

    // Extract shipping address from Stripe once — reused for both refunded and normal paths.
    // Always produce a well-shaped object with string fallbacks so GraphQL non-null fields
    // (addressLine, city, country, postalCode) never receive undefined/null.
    const stripeShipping =
      fullSession.shipping_details?.address ||
      fullSession.customer_details?.address;

    this.logger.debug(
      `Extracted shipping info: ${JSON.stringify(stripeShipping)} from Session ${fullSession.id}`,
    );

    const shippingSnapshot = {
      addressLine: stripeShipping?.line1 ?? '',
      city: stripeShipping?.city ?? '',
      country: stripeShipping?.country ?? '',
      postalCode: stripeShipping?.postal_code ?? '',
    };

    if (variant.stockQuantity < quantity) {
      // Create refunded order and payment record
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: null,
            guestEmail:
              fullSession.customer_details?.email ??
              fullSession.customer_email ??
              null,
            status: OrderStatus.REFUNDED,
            shippingAddressSnapshot: shippingSnapshot,
            subtotal: variant.price * quantity,
            totalAmount: variant.price * quantity,
            discountAmount: 0,
            items: {
              create: [
                {
                  productVariantId: variant.id,
                  quantity,
                  unitPriceAtPurchase: variant.price,
                  totalPrice: variant.price * quantity,
                  productSnapshot: {
                    productName: variant.product.name,
                    sku: variant.sku,
                    price: variant.price,
                  },
                },
              ],
            },
          },
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            stripeSessionId: fullSession.id,
            stripePaymentLinkId: fullSession.payment_link as string | null,
            paymentMethod: PaymentMethod.PAYMENT_LINK,
            status: PaymentStatus.REFUNDED,
            currency: fullSession.currency ?? 'usd',
            amount: variant.price * quantity,
            paymentDate: new Date(),
          },
        });
      });

      await this.stripe.refundPaymentIntent(
        fullSession.payment_intent as string,
      );
      this.logger.warn(
        `Session ${fullSession.id} refunded due to out-of-stock variant ${variant.id}, Order created as REFUNDED`,
      );
      return;
    }

    const unitPrice = variant.price;
    const totalAmount = unitPrice * quantity;

    const guestEmail =
      fullSession.customer_details?.email ?? fullSession.customer_email ?? null;

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: null,
          guestEmail,
          status: OrderStatus.PAID,
          shippingAddressSnapshot: shippingSnapshot,
          subtotal: totalAmount,
          totalAmount,
          discountAmount: 0,
          items: {
            create: [
              {
                productVariantId: variant.id,
                quantity,
                unitPriceAtPurchase: unitPrice,
                totalPrice: totalAmount,
                productSnapshot: {
                  productName: variant.product.name,
                  sku: variant.sku,
                  price: unitPrice,
                },
              },
            ],
          },
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          stripeSessionId: fullSession.id,
          stripePaymentLinkId: fullSession.payment_link as string | null,
          paymentMethod: PaymentMethod.PAYMENT_LINK,
          status: PaymentStatus.SUCCEEDED,
          currency: fullSession.currency ?? 'usd',
          amount: totalAmount,
          paymentDate: new Date(),
        },
      });

      // Deduct stock
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: { decrement: quantity } },
      });
    });

    this.logger.log(
      `Guest order created for session ${fullSession.id}, variant ${variantId}`,
    );
  }

  // ─────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────

  async findOne(orderId: string, userId: string, role: string) {
    const where: any = { id: orderId };

    if (role === 'CLIENT') {
      where.userId = userId;
    } else if (role === 'DELIVERY_PERSON') {
      where.deliveryPersonId = userId;
    }
    // MANAGER: no extra filter, sees all

    const order = await this.prisma.order.findFirst({
      where,
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return {
      ...order,
      promoCode: (order.promoSnapshot as any)?.code ?? null,
      shippingAddress: order.shippingAddressSnapshot,
    };
  }

  async findAll(
    userId: string,
    role: string,
    filter?: OrderFilterInput,
    limit = 20,
    offset = 0,
  ) {
    const where: any = { deletedAt: undefined };

    if (role === 'CLIENT') {
      where.userId = userId;
    } else if (role === 'DELIVERY_PERSON') {
      where.deliveryPersonId = userId;
      where.status = OrderStatus.SHIPPED;
    }

    if (filter) {
      if (filter.status) where.status = filter.status;
      if (filter.fromDate || filter.toDate) {
        where.createdAt = {
          ...(filter.fromDate && { gte: filter.fromDate }),
          ...(filter.toDate && { lte: filter.toDate }),
        };
      }
      if (filter.minAmount || filter.maxAmount) {
        where.totalAmount = {
          ...(filter.minAmount && { gte: filter.minAmount }),
          ...(filter.maxAmount && { lte: filter.maxAmount }),
        };
      }
    }

    const page = Math.max(1, Math.floor(offset / limit) + 1);

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((order) => ({
        ...order,
        promoCode: (order.promoSnapshot as any)?.code ?? null,
        shippingAddress: order.shippingAddressSnapshot,
      })),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async cancelOrder(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    // Clients can only cancel their own orders
    if (role === 'CLIENT' && order.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own orders.');
    }

    // Can't cancel once shipped
    if (
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Cannot cancel an order that has already been shipped or delivered.',
      );
    }

    const cancelled = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    return {
      ...cancelled,
      promoCode: (cancelled.promoSnapshot as any)?.code ?? null,
      shippingAddress: cancelled.shippingAddressSnapshot,
    };
  }

  // ─────────────────────────────────────────────────
  // DELIVERY WORKFLOW MUTATIONS
  // ─────────────────────────────────────────────────

  async assignOrdersToDelivery(
    orderIds: string[],
    deliveryPersonId: string,
  ): Promise<{ count: number }> {
    const deliveryPerson = await this.prisma.user.findUnique({
      where: { id: deliveryPersonId },
      select: { id: true, role: true },
    });

    if (!deliveryPerson) {
      throw new NotFoundException(`User ${deliveryPersonId} not found.`);
    }

    if (deliveryPerson.role !== 'DELIVERY_PERSON') {
      throw new BadRequestException(
        `User ${deliveryPersonId} is not a delivery person.`,
      );
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });

    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = orderIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Order(s) not found: ${missing.join(', ')}`);
    }

    const notPaid = orders.filter((o) => o.status !== OrderStatus.PAID);
    if (notPaid.length > 0) {
      throw new BadRequestException(
        `Only PAID orders can be assigned. These orders are not PAID: ${notPaid.map((o) => o.id).join(', ')}`,
      );
    }

    const result = await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: {
        deliveryPersonId,
        status: OrderStatus.PROCESSING,
      },
    });

    this.logger.log(
      `Manager assigned ${result.count} order(s) to delivery person ${deliveryPersonId}.`,
    );

    return { count: result.count };
  }

  async dispatchOrders(orderIds: string[]): Promise<{ count: number }> {
    // ── Validate all orders are PROCESSING ──────────────────────────────────
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });

    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = orderIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Order(s) not found: ${missing.join(', ')}`);
    }

    const notProcessing = orders.filter(
      (o) => o.status !== OrderStatus.PROCESSING,
    );
    if (notProcessing.length > 0) {
      throw new BadRequestException(
        `Only PROCESSING orders can be dispatched. These are not in PROCESSING state: ${notProcessing.map((o) => o.id).join(', ')}`,
      );
    }

    const result = await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: OrderStatus.SHIPPED },
    });

    this.logger.log(
      `Manager dispatched ${result.count} order(s) to SHIPPED status.`,
    );

    return { count: result.count };
  }

  async markAsDelivered(orderId: string, deliveryPersonId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException(
        `Only SHIPPED orders can be marked as delivered. Current status: ${order.status}`,
      );
    }

    if (order.deliveryPersonId !== deliveryPersonId) {
      throw new ForbiddenException(
        'You can only mark your own assigned orders as delivered.',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED },
    });

    this.logger.log(
      `Delivery person ${deliveryPersonId} marked order ${orderId} as DELIVERED.`,
    );

    return {
      ...updated,
      promoCode: (updated.promoSnapshot as any)?.code ?? null,
      shippingAddress: updated.shippingAddressSnapshot,
    };
  }
}
