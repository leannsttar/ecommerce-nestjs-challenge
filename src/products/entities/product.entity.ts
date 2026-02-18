import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Category } from '../../categories/entities/category.entity';
import { Image } from './image.entity';
import { ProductOption } from './product-option.entity';
import { Variant } from './variant.entity';

@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field({ defaultValue: true })
  isActive: boolean;

  @Field(() => [Category])
  categories: Category[];

  @Field(() => Image, { nullable: true })
  featuredImage?: Image;

  @Field(() => [Image])
  images: Image[];

  @Field(() => [ProductOption])
  options: ProductOption[];

  @Field(() => [Variant])
  variants: Variant[];

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
