import { BadRequestException } from '@nestjs/common';
import { PromoCode } from '@prisma/client';
import { PromoType } from './entities/promo-code.entity';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PromoService } from './promo.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const PROMO_ID = 'promo-uuid-1';

const mockPercentagePromo: PromoCode = {
  id: PROMO_ID,
  code: 'SAVE10',
  type: PromoType.PERCENTAGE,
  value: 10,
  expiresAt: new Date('2030-12-31'),
  usageLimit: 100,
  usageCount: 0,
  minPurchase: null,
  maxDiscountAmount: 5000,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockFixedPromo: PromoCode = {
  ...mockPercentagePromo,
  id: 'promo-uuid-2',
  code: 'FLAT500',
  type: PromoType.FIXED_AMOUNT,
  value: 500,
  maxDiscountAmount: null,
};

// ─── PromoService ─────────────────────────────────────────────────────────────

describe('PromoService', () => {
  let service: PromoService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new PromoService(prisma);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns promo codes ordered by creation date, newest first', async () => {
      const mockList = [mockPercentagePromo, mockFixedPromo];
      prisma.promoCode.findMany.mockResolvedValue(mockList);

      const actual = await service.findAll();

      expect(actual).toEqual(mockList);
      expect(prisma.promoCode.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws when a PERCENTAGE promo has a value exceeding 100', () => {
      expect(() =>
        service.create({
          code: 'BIG',
          type: PromoType.PERCENTAGE,
          value: 101,
          expiresAt: '2030-12-31',
          usageLimit: 10,
          maxDiscountAmount: 1000,
        }),
      ).toThrow(new BadRequestException('Percentage value cannot exceed 100'));
    });

    it('throws when a PERCENTAGE promo is created without a maxDiscountAmount cap', () => {
      expect(() =>
        service.create({
          code: 'NOCAP',
          type: PromoType.PERCENTAGE,
          value: 20,
          expiresAt: '2030-12-31',
          usageLimit: 10,
        }),
      ).toThrow(
        new BadRequestException(
          'PERCENTAGE promo codes must include a maxDiscountAmount',
        ),
      );
    });

    it('throws when a FIXED_AMOUNT promo specifies a maxDiscountAmount', () => {
      expect(() =>
        service.create({
          code: 'FIXED',
          type: PromoType.FIXED_AMOUNT,
          value: 500,
          expiresAt: '2030-12-31',
          usageLimit: 10,
          maxDiscountAmount: 500,
        }),
      ).toThrow(
        new BadRequestException(
          'maxDiscountAmount can only be set for PERCENTAGE type promo codes.',
        ),
      );
    });

    it('accepts a PERCENTAGE promo at exactly 100 (boundary value)', () => {
      prisma.promoCode.create.mockResolvedValue(mockPercentagePromo);

      expect(() =>
        service.create({
          code: 'FULL',
          type: PromoType.PERCENTAGE,
          value: 100,
          expiresAt: '2030-12-31',
          usageLimit: 5,
          maxDiscountAmount: 9999,
        }),
      ).not.toThrow();
    });

    it('stores the code in uppercase regardless of input casing', async () => {
      prisma.promoCode.create.mockResolvedValue(mockPercentagePromo);

      await service.create({
        code: 'save10',
        type: PromoType.PERCENTAGE,
        value: 10,
        expiresAt: '2030-12-31',
        usageLimit: 100,
        maxDiscountAmount: 5000,
      });

      expect(prisma.promoCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'SAVE10' }),
        }),
      );
    });

    it('converts the expiresAt string to a Date object before persisting', async () => {
      prisma.promoCode.create.mockResolvedValue(mockPercentagePromo);

      await service.create({
        code: 'DATECHECK',
        type: PromoType.PERCENTAGE,
        value: 10,
        expiresAt: '2030-06-15',
        usageLimit: 10,
        maxDiscountAmount: 1000,
      });

      expect(prisma.promoCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresAt: new Date('2030-06-15') }),
        }),
      );
    });

    it('defaults minPurchase and maxDiscountAmount to null when not provided', async () => {
      prisma.promoCode.create.mockResolvedValue(mockFixedPromo);

      await service.create({
        code: 'NOMIN',
        type: PromoType.FIXED_AMOUNT,
        value: 200,
        expiresAt: '2030-12-31',
        usageLimit: 50,
      });

      expect(prisma.promoCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            minPurchase: null,
            maxDiscountAmount: null,
          }),
        }),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('always fetches the promo before applying any update', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockPercentagePromo);
      prisma.promoCode.update.mockResolvedValue(mockPercentagePromo);

      await service.update(PROMO_ID, { code: 'newcode' });

      expect(prisma.promoCode.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: PROMO_ID },
      });
    });

    it('throws when the new value exceeds 100 for an already-PERCENTAGE promo', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockPercentagePromo);

      await expect(service.update(PROMO_ID, { value: 101 })).rejects.toThrow(
        new BadRequestException('Percentage value cannot exceed 100'),
      );
    });

    it('throws when the type is changed to PERCENTAGE but the new value exceeds 100', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockFixedPromo);

      await expect(
        service.update(mockFixedPromo.id, {
          type: PromoType.PERCENTAGE,
          value: 110,
          maxDiscountAmount: 1000,
        }),
      ).rejects.toThrow(
        new BadRequestException('Percentage value cannot exceed 100'),
      );
    });

    it('throws when the resolved type is PERCENTAGE but no cap exists in input or in the DB', async () => {
      // value: 20 — valid for PERCENTAGE so the >100 guard does not fire first
      const promoWithoutCap: PromoCode = {
        ...mockFixedPromo,
        value: 20,
        maxDiscountAmount: null,
      };
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(promoWithoutCap);

      await expect(
        service.update(promoWithoutCap.id, { type: PromoType.PERCENTAGE }),
      ).rejects.toThrow(
        new BadRequestException(
          'PERCENTAGE promo codes must have a maxDiscountAmount.',
        ),
      );
    });

    it('accepts a type change to PERCENTAGE when the DB already holds a valid cap', async () => {
      // value: 15 — valid for PERCENTAGE so no >100 violation when type changes
      const promoWithDbCap: PromoCode = {
        ...mockFixedPromo,
        value: 15,
        maxDiscountAmount: 2000,
      };
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(promoWithDbCap);
      prisma.promoCode.update.mockResolvedValue({
        ...promoWithDbCap,
        type: PromoType.PERCENTAGE,
      });

      await expect(
        service.update(promoWithDbCap.id, { type: PromoType.PERCENTAGE }),
      ).resolves.not.toThrow();
    });

    it('throws when maxDiscountAmount is set for a FIXED_AMOUNT type', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockFixedPromo);

      await expect(
        service.update(mockFixedPromo.id, {
          type: PromoType.FIXED_AMOUNT,
          value: 300,
          maxDiscountAmount: 500,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'maxDiscountAmount can only be set for PERCENTAGE type promo codes.',
        ),
      );
    });

    it('uppercases the code during update', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockPercentagePromo);
      prisma.promoCode.update.mockResolvedValue(mockPercentagePromo);

      await service.update(PROMO_ID, { code: 'lowercase' });

      expect(prisma.promoCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'LOWERCASE' }),
        }),
      );
    });

    it('converts expiresAt string to a Date during update', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockPercentagePromo);
      prisma.promoCode.update.mockResolvedValue(mockPercentagePromo);

      await service.update(PROMO_ID, { expiresAt: '2035-01-01' });

      expect(prisma.promoCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresAt: new Date('2035-01-01') }),
        }),
      );
    });

    it('propagates an explicit null for maxDiscountAmount to allow clearing the cap on a FIXED_AMOUNT promo', async () => {
      prisma.promoCode.findUniqueOrThrow.mockResolvedValue(mockFixedPromo);
      prisma.promoCode.update.mockResolvedValue({
        ...mockFixedPromo,
        maxDiscountAmount: null,
      });

      await service.update(mockFixedPromo.id, {
        type: PromoType.FIXED_AMOUNT,
        value: 500,
        maxDiscountAmount: null,
      });

      expect(prisma.promoCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ maxDiscountAmount: null }),
        }),
      );
    });
  });

  // ─── disable ───────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('deactivates the promo code by setting isActive to false', async () => {
      const disabled: PromoCode = { ...mockPercentagePromo, isActive: false };
      prisma.promoCode.update.mockResolvedValue(disabled);

      const actual = await service.disable(PROMO_ID);

      expect(actual.isActive).toBe(false);
      expect(prisma.promoCode.update).toHaveBeenCalledWith({
        where: { id: PROMO_ID },
        data: { isActive: false },
      });
    });
  });

  // ─── enable ────────────────────────────────────────────────────────────────

  describe('enable', () => {
    it('reactivates the promo code by setting isActive to true', async () => {
      const enabled: PromoCode = { ...mockPercentagePromo, isActive: true };
      prisma.promoCode.update.mockResolvedValue(enabled);

      const actual = await service.enable(PROMO_ID);

      expect(actual.isActive).toBe(true);
      expect(prisma.promoCode.update).toHaveBeenCalledWith({
        where: { id: PROMO_ID },
        data: { isActive: true },
      });
    });
  });
});
