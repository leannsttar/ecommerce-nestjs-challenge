import { InterfaceType, Field, ID } from '@nestjs/graphql';
import { Category } from '../../categories/entities/category.entity';
import { Image } from './image.entity';

@InterfaceType()
export abstract class ProductBase {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Category)
  category: Category;

  @Field(() => Image, { nullable: true })
  featuredImage?: Image;

  @Field(() => [Image])
  images: Image[];
}
