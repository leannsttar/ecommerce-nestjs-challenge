import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
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

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPurchase?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscountAmount?: number;
}
