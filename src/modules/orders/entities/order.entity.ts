import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { OrderStatus } from './order.enums';
import { ShippingAddress } from './shipping-address.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';

export * from './order.enums';
export * from './shipping-address.entity';
export * from './order-item.entity';
export * from './payment.entity';
export * from './paginated-orders.entity';
export * from './payment-intent-result.entity';
export * from './assignment-result.entity';

@ObjectType()
export class Order {
  @Field(() => ID)
  id: string;

  userId: string | null;
  deliveryPersonId: string | null;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => Int)
  subtotal: number;

  @Field(() => Int)
  discountAmount: number;

  @Field(() => Int)
  totalAmount: number;

  /** Promo code string from snapshot, null if none */
  @Field({ nullable: true })
  promoCode?: string;

  @Field(() => ShippingAddress)
  shippingAddress: ShippingAddress;

  @Field(() => [OrderItem])
  items: OrderItem[];

  @Field(() => [Payment])
  payments: Payment[];

  @Field()
  createdAt: Date;
}
