import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
    });
  }

  async findByIds(ids: string[]) {
    return this.prisma.category.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  async create(input: CreateCategoryInput) {
    return this.prisma.category.create({
      data: input,
    });
  }

  async update(id: string, input: UpdateCategoryInput) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: input,
      });
    } catch (error) {
      // Prisma throws error with code P2025 when record not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      // Prisma throws error with code P2025 when record not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      throw error;
    }
  }

  async getProducts(categoryId: string) {
    const productCategories = await this.prisma.productCategory.findMany({
      where: { categoryId },
      include: { product: true },
    });
    return productCategories.map((pc) => pc.product);
  }
}
