import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  ArrayMinSize,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductOptionInput } from './product-option.input';

@InputType()
export class CreateProductInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field()
  @IsString()
  @MinLength(2)
  description: string;

  @Field(() => [ID])
  @IsUUID('all', { each: true })
  @IsArray()
  @ArrayMinSize(1)
  categoryIds: string[];

  @Field()
  @IsString()
  @MinLength(3)
  featuredImage: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  // === Variable Product Fields (Mandatory) ===
  @Field(() => [ProductOptionInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInput)
  options: ProductOptionInput[];
}
