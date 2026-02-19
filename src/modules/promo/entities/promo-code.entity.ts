import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

export enum PromoType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

registerEnumType(PromoType, {
  name: 'PromoType',
});

@ObjectType()
export class PromoCode {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  @Field(() => PromoType)
  type: PromoType;

  //Discount value: percentage (e.g. 10 = 10%) or fixed amount in cents
  @Field(() => Int)
  value: number;

  @Field()
  expiresAt: Date;

  @Field(() => Int)
  usageLimit: number;

  @Field(() => Int)
  usageCount: number;

  //Minimum purchase amount in cents (optional)
  @Field(() => Int, { nullable: true })
  minPurchase: number | null;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
