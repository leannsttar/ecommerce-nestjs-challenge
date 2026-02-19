import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength, IsArray, ArrayMinSize } from 'class-validator';
import { Transform } from 'class-transformer';

@InputType()
export class ProductOptionInput {
  @Field()
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => value.trim().toLowerCase())
  name: string;

  @Field(() => [String])
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Transform(({ value }) => value.map((v: string) => v.trim().toLowerCase()))
  values: string[];
}
