import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductRelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(productId: string) {
    const productCategories = await this.prisma.productCategory.findMany({
      where: { productId },
      include: { category: true },
    });
    return productCategories.map((pc) => pc.category);
  }

  async getImages(productId: string) {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
    });
    return images.map((img) => ({ ...img, url: img.key }));
  }

  async getFeaturedImage(productId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { productId, isMain: true },
    });
    return image ? { ...image, url: image.key } : null;
  }

  async getOptions(productId: string) {
    const options = await this.prisma.productOption.findMany({
      where: { productId },
      include: { values: true },
    });

    return options.map((option) => ({
      id: option.id,
      name: option.name,
      values: option.values.map((v) => v.value),
    }));
  }

  async getVariants(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
    });
  }

  async getSelectedOptions(variantId: string) {
    const values = await this.prisma.productVariantValue.findMany({
      where: { productVariantId: variantId },
      include: {
        productOptionValue: {
          include: { option: true },
        },
      },
    });

    if (!values.length) {
      return [];
    }

    return values.map((ov) => ({
      name: ov.productOptionValue.option.name,
      value: ov.productOptionValue.value,
    }));
  }
}
