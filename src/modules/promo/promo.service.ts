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

  create(input: CreatePromoCodeInput) {
    if (input.type === PromoType.PERCENTAGE && input.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    if (input.type === PromoType.PERCENTAGE && !input.maxDiscountAmount) {
      throw new BadRequestException(
        'PERCENTAGE promo codes must include a maxDiscountAmount',
      );
    }

    if (
      input.maxDiscountAmount !== undefined &&
      input.type !== PromoType.PERCENTAGE
    ) {
      throw new BadRequestException(
        'maxDiscountAmount can only be set for PERCENTAGE type promo codes.',
      );
    }

    return this.prisma.promoCode.create({
      data: {
        ...input,
        code: input.code.toUpperCase(),
        expiresAt: new Date(input.expiresAt),
        minPurchase: input.minPurchase ?? null,
        maxDiscountAmount: input.maxDiscountAmount ?? null,
      },
    });
  }

  async update(id: string, input: UpdatePromoCodeInput) {
    const promo = await this.prisma.promoCode.findUniqueOrThrow({
      where: { id },
    });

    const type = input.type ?? promo.type;
    const value = input.value ?? promo.value;
    const maxDiscountAmount =
      input.maxDiscountAmount !== undefined
        ? input.maxDiscountAmount
        : promo.maxDiscountAmount;

    if (type === PromoType.PERCENTAGE && value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    if (type === PromoType.PERCENTAGE && !maxDiscountAmount) {
      throw new BadRequestException(
        'PERCENTAGE promo codes must have a maxDiscountAmount.',
      );
    }

    if (maxDiscountAmount && type !== PromoType.PERCENTAGE) {
      throw new BadRequestException(
        'maxDiscountAmount can only be set for PERCENTAGE type promo codes.',
      );
    }

    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...input,
        code: input.code?.toUpperCase(),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        maxDiscountAmount:
          input.maxDiscountAmount !== undefined
            ? input.maxDiscountAmount
            : undefined,
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
