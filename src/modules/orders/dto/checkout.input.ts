import { InputType, Field } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';

@InputType()
export class ShippingAddressInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  addressLine: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  city: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  country: string;

  @Field()
  @IsString()
  @IsNotEmpty()
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
  currency?: string;

  /** Optional promo code to apply a discount at checkout */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;
}
