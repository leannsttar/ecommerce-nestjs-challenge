import { registerEnumType } from '@nestjs/graphql';

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
