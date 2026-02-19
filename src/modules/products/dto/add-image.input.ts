import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';

@InputType()
export class AddImageInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
