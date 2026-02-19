import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Product } from './product.entity';

@ObjectType()
export class PaginatedProducts {
  @Field(() => [Product])
  items: Product[];

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalItems: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}
