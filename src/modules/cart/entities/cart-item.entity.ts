import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Variant } from '../../products/entities/variants/variant.entity';

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Variant)
  variant: Variant;

  @Field(() => Int)
  subtotal: number;
}
