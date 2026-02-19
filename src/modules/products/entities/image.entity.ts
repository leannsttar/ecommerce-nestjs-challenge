import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Image {
  @Field(() => ID)
  id: string;

  @Field()
  url: string;

  @Field()
  isMain: boolean;
}
