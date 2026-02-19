import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsInt, Min } from 'class-validator';

@InputType()
export class AddToCartInput {
  @Field(() => ID)
  @IsUUID()
  variantId: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
