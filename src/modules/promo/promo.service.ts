import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromoCodeInput } from './dto/create-promo-code.input';
import { UpdatePromoCodeInput } from './dto/update-promo-code.input';
import { PromoType } from './entities/promo-code.entity';

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.promoCode.findUniqueOrThrow({
      where: { id },
    });
  }

  create(input: CreatePromoCodeInput) {
    if (input.type === PromoType.PERCENTAGE && input.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }
    return this.prisma.promoCode.create({
      data: {
        ...input,
        code: input.code.toUpperCase(),
        expiresAt: new Date(input.expiresAt),
        minPurchase: input.minPurchase ?? null,
      },
    });
  }

  async update(id: string, input: UpdatePromoCodeInput) {
    if (input.type || input.value) {
      const promo = await this.findById(id);
      const type = input.type ?? promo.type;
      const value = input.value ?? promo.value;

      if (type === PromoType.PERCENTAGE && value > 100) {
        throw new BadRequestException('Percentage value cannot exceed 100');
      }
    }

    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...input,
        code: input.code?.toUpperCase(),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });
  }

  disable(id: string) {
    return this.prisma.promoCode.update({
      where: { id },
      data: { isActive: false },
    });
  }

  enable(id: string) {
    return this.prisma.promoCode.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
