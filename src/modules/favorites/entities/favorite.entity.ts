import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Variant } from '../../products/entities/variants/variant.entity';

@ObjectType()
export class Favorite {
  @Field(() => ID)
  id: string;

  @Field(() => Variant)
  variant: Variant;

  @Field()
  createdAt: Date;
}
