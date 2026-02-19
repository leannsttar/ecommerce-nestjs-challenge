import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, Min } from 'class-validator';

@InputType()
export class UpdateCartItemInput {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  quantity: number;
}
