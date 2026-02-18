import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Product } from './product.entity';

@ObjectType()
export class SelectedOption {
  @Field()
  name: string;

  @Field()
  value: string;
}

@ObjectType()
export class Variant {
  @Field(() => ID)
  id: string;

  @Field()
  sku: string;

  @Field(() => Int)
  price: number;

  @Field(() => Int)
  stockQuantity: number;

  @Field(() => Product)
  product: Product;

  @Field({ nullable: true })
  image?: string;

  @Field(() => [SelectedOption])
  selectedOptions: SelectedOption[];
}
