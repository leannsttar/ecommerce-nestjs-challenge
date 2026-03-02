import { InputType, Field } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';

@InputType()
export class ShippingAddressInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode: string;
}

@InputType()
export class CheckoutInput {
  @Field(() => ShippingAddressInput)
  @ValidateNested()
  @Type(() => ShippingAddressInput)
  shippingAddress: ShippingAddressInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['usd'])
  currency?: string;

  /** Optional promo code to apply a discount at checkout */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.toUpperCase())
  promoCode?: string;
}
