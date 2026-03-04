import { Injectable } from '@nestjs/common';
import { StripeEventHandler } from './stripe-webhook-handler.interface';
import { OrderWebhookService } from 'src/modules/orders/services/order-webhook.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentFailedHandler implements StripeEventHandler {
  readonly eventType = 'payment_intent.payment_failed';

  constructor(private readonly orderWebhookService: OrderWebhookService) {}

  async handle(event: Stripe.Event): Promise<void> {
    await this.orderWebhookService.handlePaymentIntentFailed(
      event.data.object as Stripe.PaymentIntent,
    );
  }
}
