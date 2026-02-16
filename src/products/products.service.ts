import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
    });
  }

  async findAllManager() {
    return this.prisma.product.findMany();
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findOneManager(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(input: CreateProductInput) {
    const { images, ...productData } = input;
    return this.prisma.product.create({
      data: {
        ...productData,
        images: images
          ? {
              create: images.map((url, index) => ({
                url,
                isMain: index === 0, // First image is main
              })),
            }
          : undefined,
      },
    });
  }

  async update(id: string, input: UpdateProductInput) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: input,
      });
    } catch (error) {
      // Prisma throws error with code P2025 when record not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return id;
    } catch (error) {
      // Prisma throws error with code P2025 when record not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
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
      // Prisma throws error with code P2025 when record not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
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
      // Prisma throws error with code P2025 when record not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  async getImages(productId: string) {
    return this.prisma.productImage.findMany({
      where: { productId },
    });
  }

  async getFeaturedImage(productId: string) {
    return this.prisma.productImage.findFirst({
      where: { productId, isMain: true },
    });
  }
}
