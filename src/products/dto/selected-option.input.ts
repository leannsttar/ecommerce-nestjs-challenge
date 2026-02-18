import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

@InputType()
export class SelectedOptionInput {
  @Field()
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => value.trim().toLowerCase())
  name: string;

  @Field()
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => value.trim().toLowerCase())
  value: string;
}
