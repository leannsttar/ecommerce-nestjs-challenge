import { ArgsType, Field, ID, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

@ArgsType()
export class GetProductsArgs {
  @Field(() => Int, { defaultValue: 15 })
  @IsInt()
  @IsOptional()
  limit: number = 15;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @IsOptional()
  page: number = 1;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
