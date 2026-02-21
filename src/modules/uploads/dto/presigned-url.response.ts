import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PresignedUrlResponse {
  @Field()
  presignedUrl: string;

  @Field()
  publicUrl: string;

  @Field()
  key: string;
}
