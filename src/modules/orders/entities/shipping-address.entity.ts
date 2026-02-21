import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ShippingAddress {
  @Field()
  addressLine: string;

  @Field()
  city: string;

  @Field()
  country: string;

  @Field()
  postalCode: string;
}
