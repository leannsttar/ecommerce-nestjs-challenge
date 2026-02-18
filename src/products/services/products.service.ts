import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductInput } from '../dto/create-product.input';
import { UpdateProductInput } from '../dto/update-product.input';
import { AddImageInput } from '../dto/add-image.input';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(limit: number, offset: number, categoryId?: string) {
    const where = {
      deletedAt: null,
      ...(categoryId && {
        categories: {
          some: { categoryId },
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
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

    // Deduplicación: remover featuredImage del array de images si existe
    let galleryImages = images || [];
    if (featuredImage && galleryImages.includes(featuredImage)) {
      galleryImages = galleryImages.filter((key) => key !== featuredImage);
    }

    // Construir array de imágenes a guardar
    const imagesToCreate: Array<{ url: string; isMain: boolean }> = [];

    if (featuredImage) {
      imagesToCreate.push({ url: featuredImage, isMain: true });
    }

    if (galleryImages.length > 0) {
      imagesToCreate.push(
        ...galleryImages.map((imageUrl) => ({ url: imageUrl, isMain: false })),
      );
    }

    try {
      // Use transaction for product creation
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create product with categories and images
        const product = await tx.product.create({
          data: {
            ...productData,
            categories: {
              create: categoryIds.map((id) => ({
                category: { connect: { id } },
              })),
            },
            images:
              imagesToCreate.length > 0
                ? { create: imagesToCreate }
                : undefined,
          },
        });

        // 2. Create options (Mandatory) - parallel execution
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
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('One or more categories do not exist');
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('SKU already exists');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateProductInput) {
    const { categoryIds, ...updateData } = input;

    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...updateData,
          // Update categories if provided: replace all with new set
          categories: categoryIds
            ? {
                deleteMany: {}, // Remove all existing category relations
                create: categoryIds.map((catId) => ({
                  category: { connect: { id: catId } },
                })),
              }
            : undefined,
        },
      });
    } catch (error) {
      // Prisma throws error with code P2025 when record not found
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      // Prisma throws error with code P2025 when record not found
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  async disable(id: string) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  async enable(id: string) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { isActive: true },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  async addProductImage(productId: string, input: AddImageInput) {
    try {
      return await this.prisma.productImage.create({
        data: {
          productId,
          url: input.imageUrl,
          isMain: false,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }
      throw error;
    }
  }

  async deleteProductImage(id: string) {
    try {
      return await this.prisma.productImage.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Image with ID ${id} not found`);
      }
      throw error;
    }
  }
}
