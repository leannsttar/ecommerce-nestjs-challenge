import { forwardRef, Module } from '@nestjs/common';
import { OrderCheckoutService } from './services/order-checkout.service';
import { OrderWebhookService } from './services/order-webhook.service';
import { OrderQueryService } from './services/order-query.service';
import { OrderManagementService } from './services/order-management.service';
import { OrdersResolver } from './resolvers/orders.resolver';
import { StripeModule } from '../stripe/stripe.module';
import { CaslModule } from '../../common/casl/casl.module';
import { OrderItemsDataLoader } from './loaders/order-items.dataloader';
import { OrderPaymentsDataLoader } from './loaders/order-payments.dataloader';
import { OrderReconciliationCron } from './order-reconciliation.cron';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    forwardRef(() => StripeModule),
    CaslModule,
    BullModule.registerQueue({
      name: 'stock-notifications',
    }),
  ],
  providers: [
    OrderCheckoutService,
    OrderWebhookService,
    OrderQueryService,
    OrderManagementService,
    OrdersResolver,
    OrderItemsDataLoader,
    OrderPaymentsDataLoader,
    OrderReconciliationCron,
  ],
  exports: [OrderWebhookService],
})
export class OrdersModule {}
