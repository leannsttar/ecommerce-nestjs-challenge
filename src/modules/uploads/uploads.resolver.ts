import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UploadsService } from './uploads.service';
import { GeneratePresignedUrlInput } from './dto/generate-presigned-url.input';
import { PresignedUrlResponse } from './dto/presigned-url.response';

@Resolver()
export class UploadsResolver {
  constructor(private readonly uploadsService: UploadsService) {}

  @Mutation(() => PresignedUrlResponse)
  async generatePresignedUrl(
    @Args('input') input: GeneratePresignedUrlInput,
  ): Promise<PresignedUrlResponse> {
    return this.uploadsService.generatePresignedUrl(
      input.fileName,
      input.contentType,
    );
  }
}
