import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { CartItem } from './cart-item.entity';

@ObjectType()
export class Cart {
  @Field(() => ID)
  id: string;

  userId: string;

  @Field(() => [CartItem])
  items: CartItem[];

  @Field(() => Int)
  totalQuantity: number;

  @Field(() => Int)
  subtotal: number;
}
