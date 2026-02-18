import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Product } from './product.entity';

@ObjectType()
export class PaginatedProducts {
  @Field(() => [Product])
  items: Product[];

  @Field(() => Int)
  total: number;
}
