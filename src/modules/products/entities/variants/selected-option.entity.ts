import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SelectedOption {
  @Field()
  name: string;

  @Field()
  value: string;
}
