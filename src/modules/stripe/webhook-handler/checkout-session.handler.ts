import { Injectable } from '@nestjs/common';
import { StripeEventHandler } from './stripe-webhook-handler.interface';
import { OrderWebhookService } from 'src/modules/orders/services/order-webhook.service';
import Stripe from 'stripe';

@Injectable()
export class CheckoutSessionCompletedHandler implements StripeEventHandler {
  readonly eventType = 'checkout.session.completed';

  constructor(private readonly orderWebhookService: OrderWebhookService) {}

  async handle(event: Stripe.Event): Promise<void> {
    await this.orderWebhookService.handleCheckoutSessionCompleted(
      event.data.object as Stripe.Checkout.Session,
    );
  }
}
