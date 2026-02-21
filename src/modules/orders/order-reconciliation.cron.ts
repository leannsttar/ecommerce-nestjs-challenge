import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { OrderStatus, PaymentStatus } from './entities/order.entity';

@Injectable()
export class OrderReconciliationCron {
  private readonly logger = new Logger(OrderReconciliationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Reconciliation cron: rescues inventory from abandoned checkouts.
   *
   * When a user initiates checkout, stock is immediately reserved (decremented).
   * If the user never completes payment (closes the tab, etc.), the stock stays
   * locked forever — the "Abandoned Checkout" / "Trapped Inventory" problem.
   *
   * SOLUTION:
   * Every minute, this job finds PENDING orders older than 15 minutes and:
   *   1. Cancels the Stripe PaymentIntent (prevents late payments).
   *   2. In one atomic transaction, marks Order → CANCELLED, Payment → FAILED,
   *      and restores the reserved stock back to the store.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileAbandonedOrders(): Promise<void> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const abandonedOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: fifteenMinutesAgo },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    if (abandonedOrders.length === 0) return;

    this.logger.log(
      `Reconciliation: found ${abandonedOrders.length} abandoned PENDING order(s).`,
    );

    for (const order of abandonedOrders) {
      try {
        await this.processAbandonedOrder(order);
      } catch (err) {
        this.logger.error(
          `Failed to reconcile order ${order.id}: ${err.message}`,
          err.stack,
        );
      }
    }
  }

  private async processAbandonedOrder(
    order: Awaited<ReturnType<typeof this.prisma.order.findMany>>[number] & {
      items: { productVariantId: string; quantity: number }[];
      payments: { stripePaymentIntentId: string | null }[];
    },
  ): Promise<void> {
    const paymentIntentId = order.payments[0]?.stripePaymentIntentId;
    if (paymentIntentId) {
      try {
        await this.stripe.cancelPaymentIntent(paymentIntentId);
        this.logger.debug(
          `Canceled Stripe PI ${paymentIntentId} for order ${order.id}.`,
        );
      } catch (err) {
        // Ignore "already canceled" errors; log anything else
        const alreadyCanceled =
          err?.raw?.code === 'payment_intent_unexpected_state' ||
          err?.message?.includes('already been canceled');

        if (!alreadyCanceled) {
          this.logger.warn(
            `Could not cancel PI ${paymentIntentId}: ${err.message}`,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED },
      });

      if (count === 0) {
        this.logger.log(
          `Order ${order.id} was already processed by another process. Skipping stock restore.`,
        );
        return;
      }

      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: PaymentStatus.FAILED },
      });

      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      this.logger.log(
        `Order ${order.id} canceled and stock restored for ${order.items.length} item(s).`,
      );
    });
  }
}
