import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductInput } from '../dto/create-product.input';
import { UpdateProductInput } from '../dto/update-product.input';
import { AddImageInput } from '../dto/add-image.input';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    limit: number,
    page: number,
    categoryId?: string,
    includeInactive: boolean = false,
  ) {
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      isActive: includeInactive ? undefined : true,
      ...(categoryId && {
        categories: {
          some: { categoryId },
        },
      }),
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      page: page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(input: CreateProductInput) {
    const { images, featuredImage, categoryIds, options, ...productData } =
      input;

    // remove featuredImage from images array if exists
    let galleryImages = images || [];
    if (featuredImage && galleryImages.includes(featuredImage)) {
      galleryImages = galleryImages.filter((key) => key !== featuredImage);
    }

    // Build array of images to save
    const imagesToCreate: Array<{ url: string; isMain: boolean }> = [];

    if (featuredImage) {
      imagesToCreate.push({ url: featuredImage, isMain: true });
    }

    if (galleryImages.length > 0) {
      imagesToCreate.push(
        ...galleryImages.map((imageUrl) => ({ url: imageUrl, isMain: false })),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const imagesData =
        imagesToCreate.length > 0 ? { create: imagesToCreate } : undefined;

      const product = await tx.product.create({
        data: {
          name: productData.name,
          description: productData.description,
          categories: {
            create: categoryIds.map((id) => ({
              category: { connect: { id } },
            })),
          },
          images: imagesData,
        },
      });

      await Promise.all(
        options.map((option) =>
          tx.productOption.create({
            data: {
              productId: product.id,
              name: option.name,
              values: {
                create: option.values.map((value) => ({ value })),
              },
            },
          }),
        ),
      );

      return product;
    });
  }

  async update(id: string, input: UpdateProductInput) {
    const { categoryIds, ...updateData } = input;

    const categoriesUpdate = categoryIds
      ? {
          deleteMany: {}, // Remove all
          create: categoryIds.map((catId) => ({
            category: { connect: { id: catId } },
          })),
        }
      : undefined;

    return this.prisma.product.update({
      where: { id },
      data: {
        name: updateData.name,
        description: updateData.description,
        categories: categoriesUpdate,
      },
    });
  }

  /**
   * Soft delete the product.
   */
  async remove(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Disable the product (sets isActive=false).
   */
  async disable(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async enable(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async addProductImage(productId: string, input: AddImageInput) {
    return this.prisma.productImage.create({
      data: {
        productId,
        url: input.imageUrl,
        isMain: false,
      },
    });
  }

  async deleteProductImage(id: string) {
    return this.prisma.productImage.delete({
      where: { id },
    });
  }
}
