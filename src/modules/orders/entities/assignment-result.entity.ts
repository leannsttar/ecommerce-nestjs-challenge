import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AssignmentResult {
  @Field(() => Int, {
    description: 'Number of orders successfully updated.',
  })
  count: number;
}
