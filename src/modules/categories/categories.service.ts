import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

  async create(input: CreateCategoryInput) {
    return this.prisma.category.create({
      data: input,
    });
  }

  async update(id: string, input: UpdateCategoryInput) {
    return this.prisma.category.update({
      where: { id },
      data: input,
    });
  }

  async remove(id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
