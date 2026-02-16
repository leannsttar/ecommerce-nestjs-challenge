import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsUUID, IsOptional } from 'class-validator';

@InputType()
export class UpdateProductInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
