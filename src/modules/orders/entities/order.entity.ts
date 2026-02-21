import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

/**
 * 📖 CONCEPT: GraphQL Enums
 * These match the database enums exactly. NestJS needs them registered
 * for the GraphQL schema to include them.
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

registerEnumType(OrderStatus, { name: 'OrderStatus' });

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

export enum PaymentMethod {
  PAYMENT_LINK = 'PAYMENT_LINK',
  PAYMENT_INTENT = 'PAYMENT_INTENT',
}

registerEnumType(PaymentMethod, { name: 'PaymentMethod' });

@ObjectType()
export class ShippingAddress {
  @Field()
  addressLine: string;

  @Field()
  city: string;

  @Field()
  country: string;

  @Field()
  postalCode: string;
}

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Int)
  price: number;

  @Field(() => Int)
  total: number;

  @Field()
  productTitle: string;

  @Field()
  variantTitle: string;
}

@ObjectType()
export class Payment {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  amount: number;

  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field()
  createdAt: Date;
}

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

@ObjectType()
export class PaginatedOrders {
  @Field(() => [Order])
  items: Order[];

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalItems: number;

  @Field(() => Int)
  totalPages: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}

@ObjectType()
export class PaymentIntentResult {
  @Field()
  clientSecret: string;

  @Field(() => ID)
  orderId: string;

  @Field(() => Int, { description: 'The final charged amount in cents' })
  amount: number;
}

@ObjectType()
export class AssignmentResult {
  @Field(() => Int, {
    description: 'Number of orders successfully updated.',
  })
  count: number;
}
