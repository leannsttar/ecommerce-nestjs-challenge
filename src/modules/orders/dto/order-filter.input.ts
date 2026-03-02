import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

@InputType()
export class OrderFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  fromDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  toDate?: Date;

  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAmount?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAmount?: number;
}
