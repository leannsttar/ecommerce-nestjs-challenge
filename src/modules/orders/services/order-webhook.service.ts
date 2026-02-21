import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './../entities/order.entity';
import Stripe from 'stripe';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrderWebhookService {
  private readonly logger = new Logger(OrderWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    @InjectQueue('stock-notifications') private readonly stockQueue: Queue,
  ) {}

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
        data: { status: PaymentStatus.SUCCEEDED, paymentDate: new Date() },
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

    const stripeShipping =
      fullSession.shipping_details?.address ||
      fullSession.customer_details?.address;
    const shippingSnapshot = {
      addressLine: stripeShipping?.line1 ?? '',
      city: stripeShipping?.city ?? '',
      country: stripeShipping?.country ?? '',
      postalCode: stripeShipping?.postal_code ?? '',
    };

    if (variant.stockQuantity < quantity) {
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

      const updatedVariant = await tx.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: { decrement: quantity } },
      });

      if (updatedVariant.stockQuantity === 3) {
        await this.stockQueue.add('notify', { variantId: updatedVariant.id });
      }
    });

    this.logger.log(
      `Guest order created for session ${fullSession.id}, variant ${variantId}`,
    );
  }
}
