import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsUUID, IsArray, IsOptional } from 'class-validator';

@InputType()
export class CreateProductInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  description: string;

  @Field(() => ID)
  @IsUUID()
  categoryId: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  images?: string[];
}
