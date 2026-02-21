import { Controller, Post, Req, Res, Headers, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { OrdersService } from '../orders/orders.service';
import Stripe from 'stripe';
import { Public } from '../auth/decorators/public.decorator';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly ordersService: OrdersService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('No raw body found on request. Check middleware.');
      res.status(400).send('No raw body');
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    this.logger.log(`Received Stripe event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.ordersService.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.payment_failed':
          await this.ordersService.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'checkout.session.completed':
          await this.ordersService.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      // If we respond with anything other than 200, Stripe will RETRY the webhook.
      res.status(200).json({ received: true });
    } catch (err) {
      this.logger.error(
        `Error handling Stripe event ${event.type}: ${err.message}`,
        err.stack,
      );

      res.status(500).send('Internal server error during event handling');
    }
  }
}
