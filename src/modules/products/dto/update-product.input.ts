import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsUUID, IsOptional, IsArray, ArrayMinSize, MinLength } from 'class-validator';

@InputType()
export class UpdateProductInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(2)
  description?: string;

  @Field(() => [ID], { nullable: true })
  @IsUUID('all', { each: true })
  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  categoryIds?: string[];
}
