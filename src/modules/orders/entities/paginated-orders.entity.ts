import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Order } from './order.entity';

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
