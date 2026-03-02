import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(userId: string, variantId: string): Promise<boolean> {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_variantId: { userId, variantId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return false;
    }

    await this.prisma.favorite.create({ data: { userId, variantId } });
    return true;
  }

  findAllForUser(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { variant: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
