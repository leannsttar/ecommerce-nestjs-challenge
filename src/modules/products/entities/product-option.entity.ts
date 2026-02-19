import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ProductOption {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => [String])
  values: string[];
}
