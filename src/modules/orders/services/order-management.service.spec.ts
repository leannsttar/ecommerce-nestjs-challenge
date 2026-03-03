import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Order, Prisma, User } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus } from '../entities/order.entity';
import { OrderManagementService } from './order-management.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const ORDER_ID = 'order-uuid-1';
const USER_ID = 'client-uuid-1';
const DELIVERY_PERSON_ID = 'delivery-uuid-1';

/**
 * A fully-paid order that is in a "safe-to-act-on" initial state for most tests.
 * Individual tests override `status` or other fields as needed.
 */
const mockOrder: Order = {
  id: ORDER_ID,
  userId: USER_ID,
  guestEmail: null,
  status: OrderStatus.PAID,
  deliveryPersonId: DELIVERY_PERSON_ID,
  shippingAddressSnapshot: {
    street: '123 Test St',
    city: 'Testville',
  } as Prisma.JsonObject,
  promoCodeId: null,
  promoSnapshot: { code: 'SUMMER20', discount: 20 } as Prisma.JsonObject,
  subtotal: 100,
  discountAmount: 20,
  totalAmount: 80,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockDeliveryUser: Pick<User, 'id' | 'role'> = {
  id: DELIVERY_PERSON_ID,
  role: 'DELIVERY_PERSON',
};

// ─── OrderManagementService ───────────────────────────────────────────────────

describe('OrderManagementService', () => {
  let service: OrderManagementService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new OrderManagementService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── cancelOrder ───────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('should throw NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelOrder(ORDER_ID, USER_ID, 'CLIENT'),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when a CLIENT tries to cancel another user's order", async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 'another-user-id',
        status: OrderStatus.PENDING,
      });

      await expect(
        service.cancelOrder(ORDER_ID, USER_ID, 'CLIENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnprocessableEntityException when the order is already SHIPPED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SHIPPED,
      });

      await expect(
        service.cancelOrder(ORDER_ID, USER_ID, 'MANAGER'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when the order is already DELIVERED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      await expect(
        service.cancelOrder(ORDER_ID, USER_ID, 'MANAGER'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should cancel the order and map promoCode and shippingAddress from snapshots', async () => {
      const pendingOrder: Order = { ...mockOrder, status: OrderStatus.PENDING };
      const cancelledOrder: Order = {
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      };

      prisma.order.findUnique.mockResolvedValue(pendingOrder);
      prisma.order.update.mockResolvedValue(cancelledOrder);

      const actual = await service.cancelOrder(ORDER_ID, USER_ID, 'CLIENT');

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(actual.promoCode).toBe('SUMMER20');
      expect(actual.shippingAddress).toEqual(mockOrder.shippingAddressSnapshot);
    });

    it('should allow a MANAGER to cancel any order regardless of ownership', async () => {
      const pendingOrder: Order = {
        ...mockOrder,
        userId: 'someone-else',
        status: OrderStatus.PENDING,
      };
      const cancelledOrder: Order = {
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      };

      prisma.order.findUnique.mockResolvedValue(pendingOrder);
      prisma.order.update.mockResolvedValue(cancelledOrder);

      // Should NOT throw — managers bypass ownership check
      await expect(
        service.cancelOrder(ORDER_ID, USER_ID, 'MANAGER'),
      ).resolves.not.toThrow();
    });
  });

  // ─── prepareOrder ───────────────────────────────────────────────────────────

  describe('prepareOrder', () => {
    it('should throw NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.prepareOrder(ORDER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnprocessableEntityException when the order is not in PAID status', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PROCESSING,
      });

      await expect(service.prepareOrder(ORDER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should transition a PAID order to PROCESSING and map promoCode and shippingAddress', async () => {
      const paidOrder: Order = { ...mockOrder, status: OrderStatus.PAID };
      const processingOrder: Order = {
        ...paidOrder,
        status: OrderStatus.PROCESSING,
      };

      prisma.order.findUnique.mockResolvedValue(paidOrder);
      prisma.order.update.mockResolvedValue(processingOrder);

      const actual = await service.prepareOrder(ORDER_ID);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { status: OrderStatus.PROCESSING },
      });
      expect(actual.status).toBe(OrderStatus.PROCESSING);
      expect(actual.promoCode).toBe('SUMMER20');
      expect(actual.shippingAddress).toEqual(mockOrder.shippingAddressSnapshot);
    });
  });

  // ─── assignAndShipOrders ────────────────────────────────────────────────────

  describe('assignAndShipOrders', () => {
    it('should throw NotFoundException when the delivery person user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignAndShipOrders([ORDER_ID], DELIVERY_PERSON_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the specified user is not a DELIVERY_PERSON', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: DELIVERY_PERSON_ID,
        role: 'CLIENT',
      } as User);

      await expect(
        service.assignAndShipOrders([ORDER_ID], DELIVERY_PERSON_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when one or more orderIds are not found in the database', async () => {
      const missingId = 'order-uuid-missing';
      prisma.user.findUnique.mockResolvedValue(mockDeliveryUser as User);
      prisma.order.findMany.mockResolvedValue([
        { id: ORDER_ID, status: OrderStatus.PROCESSING },
      ] as Order[]);

      await expect(
        service.assignAndShipOrders([ORDER_ID, missingId], DELIVERY_PERSON_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException when any order is not in PROCESSING status', async () => {
      const paidOrderId = 'order-uuid-2';
      prisma.user.findUnique.mockResolvedValue(mockDeliveryUser as User);
      prisma.order.findMany.mockResolvedValue([
        { id: ORDER_ID, status: OrderStatus.PROCESSING },
        { id: paidOrderId, status: OrderStatus.PAID },
      ] as Order[]);

      await expect(
        service.assignAndShipOrders(
          [ORDER_ID, paidOrderId],
          DELIVERY_PERSON_ID,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should assign the delivery person and move all PROCESSING orders to SHIPPED, returning the count', async () => {
      const secondOrderId = 'order-uuid-2';
      prisma.user.findUnique.mockResolvedValue(mockDeliveryUser as User);
      prisma.order.findMany.mockResolvedValue([
        { id: ORDER_ID, status: OrderStatus.PROCESSING },
        { id: secondOrderId, status: OrderStatus.PROCESSING },
      ] as Order[]);
      prisma.order.updateMany.mockResolvedValue({ count: 2 });

      const actual = await service.assignAndShipOrders(
        [ORDER_ID, secondOrderId],
        DELIVERY_PERSON_ID,
      );

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [ORDER_ID, secondOrderId] } },
        data: {
          deliveryPersonId: DELIVERY_PERSON_ID,
          status: OrderStatus.SHIPPED,
        },
      });
      expect(actual).toEqual({ count: 2 });
    });
  });

  // ─── markAsDelivered ────────────────────────────────────────────────────────

  describe('markAsDelivered', () => {
    it('should throw NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsDelivered(ORDER_ID, DELIVERY_PERSON_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException when the order is not in SHIPPED status', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PROCESSING,
      });

      await expect(
        service.markAsDelivered(ORDER_ID, DELIVERY_PERSON_ID),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw ForbiddenException when the delivery person is not the one assigned to the order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SHIPPED,
        deliveryPersonId: 'another-delivery-person-id',
      });

      await expect(
        service.markAsDelivered(ORDER_ID, DELIVERY_PERSON_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should mark the order as DELIVERED and map promoCode and shippingAddress from snapshots', async () => {
      const shippedOrder: Order = {
        ...mockOrder,
        status: OrderStatus.SHIPPED,
        deliveryPersonId: DELIVERY_PERSON_ID,
      };
      const deliveredOrder: Order = {
        ...shippedOrder,
        status: OrderStatus.DELIVERED,
      };

      prisma.order.findUnique.mockResolvedValue(shippedOrder);
      prisma.order.update.mockResolvedValue(deliveredOrder);

      const actual = await service.markAsDelivered(
        ORDER_ID,
        DELIVERY_PERSON_ID,
      );

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { status: OrderStatus.DELIVERED },
      });
      expect(actual.promoCode).toBe('SUMMER20');
      expect(actual.shippingAddress).toEqual(mockOrder.shippingAddressSnapshot);
    });

    it('should map promoCode to null when order has no promo snapshot', async () => {
      const shippedOrderNoPromo: Order = {
        ...mockOrder,
        status: OrderStatus.SHIPPED,
        deliveryPersonId: DELIVERY_PERSON_ID,
        promoSnapshot: null,
      };
      const deliveredOrder: Order = {
        ...shippedOrderNoPromo,
        status: OrderStatus.DELIVERED,
      };

      prisma.order.findUnique.mockResolvedValue(shippedOrderNoPromo);
      prisma.order.update.mockResolvedValue(deliveredOrder);

      const actual = await service.markAsDelivered(
        ORDER_ID,
        DELIVERY_PERSON_ID,
      );

      expect(actual.promoCode).toBeNull();
    });
  });
});
