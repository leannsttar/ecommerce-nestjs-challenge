import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsInt, Min, IsArray, ArrayMinSize, IsOptional, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SelectedOptionInput } from './selected-option.input';

@InputType()
export class CreateVariantInput {
  @Field()
  @IsString()
  @MinLength(1)
  sku: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  price: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  stockQuantity: number;

  @Field(() => [SelectedOptionInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SelectedOptionInput)
  selectedOptions: SelectedOptionInput[];

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  image?: string;
}
