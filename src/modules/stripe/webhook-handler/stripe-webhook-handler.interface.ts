import Stripe from 'stripe';

export interface StripeEventHandler {
  readonly eventType: string;
  handle(event: Stripe.Event): Promise<void>;
}
