import { forwardRef, Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { OrdersModule } from '../orders/orders.module';
import { StripeHandlerFactory } from './webhook-factory.service';

import { PaymentSucceededHandler } from './webhook-handler/payment-succeeded.handler';
import { PaymentFailedHandler } from './webhook-handler/payment-failed.handler';
import { CheckoutSessionCompletedHandler } from './webhook-handler/checkout-session.handler';

import { STRIPE_HANDLERS_TOKEN } from './stripe.constants';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [StripeWebhookController],
  providers: [
    StripeService,
    StripeHandlerFactory,

    PaymentSucceededHandler,
    PaymentFailedHandler,
    CheckoutSessionCompletedHandler,

    {
      provide: STRIPE_HANDLERS_TOKEN,
      useFactory: (...handlers) => handlers,
      inject: [
        PaymentSucceededHandler,
        PaymentFailedHandler,
        CheckoutSessionCompletedHandler,
      ],
    },
  ],
  exports: [StripeService],
})
export class StripeModule {}
