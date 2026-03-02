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
    if (input.type === PromoType.PERCENTAGE && !input.maxDiscountAmount) {
      throw new BadRequestException(
        'PERCENTAGE promo codes must include a maxDiscountAmount',
      );
    }

    if (input.maxDiscountAmount != null && input.type !== PromoType.PERCENTAGE) {
      throw new BadRequestException(
        'maxDiscountAmount can only be set for PERCENTAGE type promo codes.',
      );
    }

    const { code, type, value, expiresAt, usageLimit, minPurchase, maxDiscountAmount } = input;

    const normalizedCode = code.toUpperCase();
    const expiryDate = new Date(expiresAt);
    const minPurchaseAmount = minPurchase ?? null;
    const discountCap = maxDiscountAmount ?? null;

    return this.prisma.promoCode.create({
      data: {
        code: normalizedCode,
        type,
        value,
        expiresAt: expiryDate,
        usageLimit,
        minPurchase: minPurchaseAmount,
        maxDiscountAmount: discountCap,
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

    const { code, usageLimit, minPurchase } = input;

    const normalizedCode = code?.toUpperCase();
    const expiryDate = input.expiresAt ? new Date(input.expiresAt) : undefined;

    return this.prisma.promoCode.update({
      where: { id },
      data: {
        code: normalizedCode,
        type: input.type,
        value: input.value,
        expiresAt: expiryDate,
        usageLimit,
        minPurchase,
        maxDiscountAmount: input.maxDiscountAmount,
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
