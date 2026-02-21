import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class PaymentIntentResult {
  @Field()
  clientSecret: string;

  @Field(() => ID)
  orderId: string;

  @Field(() => Int, { description: 'The final charged amount in cents' })
  amount: number;
}
