import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsInt, Min, IsOptional, MinLength } from 'class-validator';

@InputType()
export class UpdateVariantInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(1)
  sku?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  price?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  image?: string;
}
