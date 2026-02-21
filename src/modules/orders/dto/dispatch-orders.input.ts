import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, ArrayNotEmpty, ArrayMinSize } from 'class-validator';

@InputType()
export class DispatchOrdersInput {
  @Field(() => [ID])
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  orderIds: string[];
}
