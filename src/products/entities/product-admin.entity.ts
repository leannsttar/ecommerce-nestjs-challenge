import { ObjectType, Field } from '@nestjs/graphql';
import { ProductBase } from './product-base.interface';

@ObjectType({ implements: () => [ProductBase] })
export class ProductAdmin extends ProductBase {
  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
