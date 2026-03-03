import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Order, Prisma } from '@prisma/client';
import { OrderStatus } from '../entities/order.entity';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const ORDER_ID = 'order-uuid-1';
const USER_ID = 'client-uuid-1';
const DELIVERY_PERSON_ID = 'delivery-uuid-1';

const mockOrder: Order = {
  id: ORDER_ID,
  userId: USER_ID,
  guestEmail: null,
  status: OrderStatus.PENDING,
  deliveryPersonId: null,
  shippingAddressSnapshot: {
    street: '123 Test St',
    city: 'Testville',
  } as Prisma.JsonObject,
  promoCodeId: null,
  promoSnapshot: { code: 'SUMMER20', discount: 20 } as Prisma.JsonObject,
  subtotal: 100,
  discountAmount: 0,
  totalAmount: 100,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

// ─── OrderQueryService ────────────────────────────────────────────────────────

describe('OrderQueryService', () => {
  let service: OrderQueryService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new OrderQueryService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should throw NotFoundException when the order does not exist', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(ORDER_ID, USER_ID, 'CLIENT'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID, userId: USER_ID },
      });
    });

    it('should restrict the query to userId when role is CLIENT', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const actual = await service.findOne(ORDER_ID, USER_ID, 'CLIENT');

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID, userId: USER_ID },
      });
      expect(actual.id).toBe(ORDER_ID);
    });

    it('should restrict the query to deliveryPersonId when role is DELIVERY_PERSON', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      await service.findOne(ORDER_ID, DELIVERY_PERSON_ID, 'DELIVERY_PERSON');

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID, deliveryPersonId: DELIVERY_PERSON_ID },
      });
    });

    it('should not restrict by user fields when role is MANAGER', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      await service.findOne(ORDER_ID, 'manager-id', 'MANAGER');

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
      });
    });

    it('should map promo code and shipping address correctly when they exist', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const actual = await service.findOne(ORDER_ID, 'manager-id', 'MANAGER');

      expect(actual.promoCode).toBe('SUMMER20');
      expect(actual.shippingAddress).toEqual(mockOrder.shippingAddressSnapshot);
    });

    it('should map promo code to null when no promo snapshot exists', async () => {
      const orderWithoutPromo: Order = { ...mockOrder, promoSnapshot: null };
      prisma.order.findFirst.mockResolvedValue(orderWithoutPromo);

      const actual = await service.findOne(ORDER_ID, 'manager-id', 'MANAGER');

      expect(actual.promoCode).toBeNull();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should restrict query to userId when role is CLIENT and return paginated results', async () => {
      // 25 items total, page 1 of 3
      prisma.$transaction.mockResolvedValue([[mockOrder], 25] as [
        Order[],
        number,
      ]);

      const actual = await service.findAll(USER_ID, 'CLIENT', undefined, 10, 0);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          take: 10,
          skip: 0,
        }),
      );
      expect(actual.totalItems).toBe(25);
      expect(actual.totalPages).toBe(3);
      expect(actual.page).toBe(1);
      expect(actual.hasNextPage).toBe(true);
      expect(actual.hasPreviousPage).toBe(false);
      expect(actual.items[0].promoCode).toBe('SUMMER20');
      expect(actual.items[0].shippingAddress).toEqual(
        mockOrder.shippingAddressSnapshot,
      );
    });

    it('should restrict query to specifically SHIPPED orders assigned to the delivery person when role is DELIVERY_PERSON', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as [Order[], number]);

      await service.findAll(
        DELIVERY_PERSON_ID,
        'DELIVERY_PERSON',
        undefined,
        10,
        0,
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deliveryPersonId: DELIVERY_PERSON_ID,
            status: OrderStatus.SHIPPED,
          },
        }),
      );
    });

    it('should properly calculate page metadata for a middle page', async () => {
      // page=2, limit=10. 25 items -> 3 pages.
      prisma.$transaction.mockResolvedValue([[mockOrder], 25] as [
        Order[],
        number,
      ]);

      const actual = await service.findAll(
        'manager-id',
        'MANAGER',
        undefined,
        10,
        2,
      );

      expect(actual.page).toBe(2);
      expect(actual.hasNextPage).toBe(true);
      expect(actual.hasPreviousPage).toBe(true);
    });

    it('should apply all filters (status, dates, amounts) simultaneously', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as [Order[], number]);

      const filterDateStart = new Date('2024-01-01');
      const filterDateEnd = new Date('2024-01-31');

      await service.findAll('manager-id', 'MANAGER', {
        status: OrderStatus.PAID,
        fromDate: filterDateStart,
        toDate: filterDateEnd,
        minAmount: 50,
        maxAmount: 200,
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: OrderStatus.PAID,
            createdAt: { gte: filterDateStart, lte: filterDateEnd },
            totalAmount: { gte: 50, lte: 200 },
          },
        }),
      );
    });

    it('should apply partial filters correctly (e.g. only fromDate, only maxAmount)', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as [Order[], number]);

      await service.findAll('manager-id', 'MANAGER', {
        fromDate: new Date('2024-01-01'),
        maxAmount: 200,
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date('2024-01-01') },
            totalAmount: { lte: 200 },
          }),
        }),
      );
    });
  });
});
