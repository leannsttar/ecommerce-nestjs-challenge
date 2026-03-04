import { Injectable, Inject, Logger } from '@nestjs/common';
import { Stripe } from 'stripe';
import { STRIPE_HANDLERS_TOKEN } from './stripe.constants';
import { StripeEventHandler } from './webhook-handler/stripe-webhook-handler.interface';

@Injectable()
export class StripeHandlerFactory {
  private readonly logger = new Logger(StripeHandlerFactory.name);
  private readonly handlers = new Map<string, StripeEventHandler>();

  constructor(
    // We inject an array of all classes that implement the interface
    @Inject(STRIPE_HANDLERS_TOKEN)
    private readonly registeredHandlers: StripeEventHandler[],
  ) {
    // Map them by their event type string for O(1) lookups
    this.registeredHandlers.forEach((handler) => {
      this.handlers.set(handler.eventType, handler);
    });
  }

  async runHandler(event: Stripe.Event): Promise<void> {
    const handler = this.handlers.get(event.type);

    if (!handler) {
      this.logger.log(`No handler registered for event: ${event.type}`);
      return;
    }

    await handler.handle(event);
  }
}
