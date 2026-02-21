import { forwardRef, Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersResolver } from './resolvers/orders.resolver';
import { StripeModule } from '../stripe/stripe.module';
import { CaslModule } from '../../common/casl/casl.module';
import { OrderItemsDataLoader } from './loaders/order-items.dataloader';
import { OrderPaymentsDataLoader } from './loaders/order-payments.dataloader';
import { OrderReconciliationCron } from './order-reconciliation.cron';

@Module({
  imports: [forwardRef(() => StripeModule), CaslModule],
  providers: [
    OrdersService,
    OrdersResolver,
    OrderItemsDataLoader,
    OrderPaymentsDataLoader,
    OrderReconciliationCron,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
