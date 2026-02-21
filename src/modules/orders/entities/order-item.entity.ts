import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

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
