import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class UpdateCategoryInput {
  @Field()
  @IsString()
  @MinLength(1)
  name: string;
}
