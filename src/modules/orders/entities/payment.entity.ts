import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { PaymentMethod, PaymentStatus } from './order.enums';

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
