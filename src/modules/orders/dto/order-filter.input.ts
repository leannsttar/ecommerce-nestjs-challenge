import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsEnum } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

@InputType()
export class OrderFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  fromDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  toDate?: Date;

  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  minAmount?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  maxAmount?: number;
}
