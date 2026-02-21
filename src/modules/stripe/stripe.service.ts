import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(config.getOrThrow<string>('app.stripeSecretKey'), {
      // Always pin the API version! This prevents breaking changes from
      // Stripe's automatic upgrades affecting your production app.
      apiVersion: '2026-01-28.clover',
    });
  }

  async createProduct(params: { name: string; description?: string }) {
    return this.stripe.products.create({
      name: params.name,
      description: params.description,
    });
  }

  async deactivateProduct(stripeProductId: string) {
    return this.stripe.products.update(stripeProductId, { active: false });
  }

  async createPrice(params: {
    stripeProductId: string;
    unitAmount: number;
    currency?: string;
    metadata?: Record<string, string>;
  }) {
    return this.stripe.prices.create({
      product: params.stripeProductId,
      unit_amount: params.unitAmount,
      currency: params.currency ?? 'usd',
      metadata: params.metadata,
    });
  }

  async deactivatePrice(stripePriceId: string) {
    return this.stripe.prices.update(stripePriceId, { active: false });
  }

  async createPaymentLink(params: {
    stripePriceId: string;
    variantId: string;
  }) {
    return this.stripe.paymentLinks.create({
      line_items: [
        {
          price: params.stripePriceId,
          quantity: 1,
          adjustable_quantity: {
            enabled: false,
          },
        },
      ],

      metadata: {
        variantId: params.variantId,
        source: 'payment_link',
      },
      shipping_address_collection: {
        allowed_countries: ['SV', 'US', 'MX', 'CA', 'GB', 'DE', 'FR', 'ES'],
      },
    });
  }

  async deactivatePaymentLink(stripePaymentLinkId: string) {
    return this.stripe.paymentLinks.update(stripePaymentLinkId, {
      active: false,
    });
  }

  async retrieveCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product'],
    });
  }

  async createPaymentIntent(params: {
    amount: number;
    currency?: string;
    orderId?: string;
    userId?: string;
    stripeCustomerId?: string;
  }) {
    return this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency ?? 'usd',
      customer: params.stripeCustomerId,

      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        ...(params.orderId && { orderId: params.orderId }),
        userId: params.userId ?? 'guest',
        source: 'cart_checkout',
      },
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.getOrThrow<string>('app.stripeWebhookSecret');
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async cancelPaymentIntent(paymentIntentId: string) {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  async updatePaymentIntentMetadata(paymentIntentId: string, orderId: string) {
    return this.stripe.paymentIntents.update(paymentIntentId, {
      metadata: { orderId },
    });
  }

  async refundPaymentIntent(paymentIntentId: string) {
    return this.stripe.refunds.create({ payment_intent: paymentIntentId });
  }
}
