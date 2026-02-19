import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { PromoType } from '../entities/promo-code.entity';

@InputType()
export class CreatePromoCodeInput {
  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  code: string;

  @Field(() => PromoType)
  @IsEnum(PromoType)
  type: PromoType;

  //Discount value: percentage points (1-100) or fixed amount in cents
  @Field(() => Int)
  @IsInt()
  @Min(1)
  value: number;

  @Field()
  @IsDateString()
  expiresAt: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  usageLimit: number;

  //Minimum purchase amount in cents (optional)
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPurchase?: number;
}
