import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsMimeType } from 'class-validator';

@InputType()
export class GeneratePresignedUrlInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @Field()
  @IsNotEmpty()
  @IsMimeType()
  contentType: string;
}
