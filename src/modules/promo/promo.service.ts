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
    if (input.type || input.value) {
      const promo = await this.findById(id);
      const type = input.type ?? promo.type;
      const value = input.value ?? promo.value;

      if (type === PromoType.PERCENTAGE && value > 100) {
        throw new BadRequestException('Percentage value cannot exceed 100');
      }

      // If the resolved type is PERCENTAGE, a cap must exist (either from input or already in DB)
      if (type === PromoType.PERCENTAGE) {
        const resolvedCap =
          input.maxDiscountAmount !== undefined
            ? input.maxDiscountAmount
            : promo.maxDiscountAmount;
        if (!resolvedCap) {
          throw new BadRequestException(
            'PERCENTAGE promo codes must have a maxDiscountAmount. Provide one or update the type.',
          );
        }
      }

      // If updating type to FIXED_AMOUNT, validate that maxDiscountAmount isn't being set
      if (
        input.maxDiscountAmount !== undefined &&
        input.maxDiscountAmount !== null &&
        type !== PromoType.PERCENTAGE
      ) {
        throw new BadRequestException(
          'maxDiscountAmount can only be set for PERCENTAGE type promo codes.',
        );
      }
    }

    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...input,
        code: input.code?.toUpperCase(),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        // Explicitly handle null to allow clearing the cap
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
