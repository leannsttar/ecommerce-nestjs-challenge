import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderFilterInput } from '../dto/order-filter.input';
import { OrderStatus } from '../entities/order.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(orderId: string, userId: string, role: string) {
    const where: Prisma.OrderWhereInput = { id: orderId };

    if (role === 'CLIENT') {
      where.userId = userId;
    } else if (role === 'DELIVERY_PERSON') {
      where.deliveryPersonId = userId;
    }

    const order = await this.prisma.order.findFirst({ where });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return {
      ...order,
      promoCode: (order.promoSnapshot as any)?.code ?? null,
      shippingAddress: order.shippingAddressSnapshot,
    };
  }

  async findAll(
    userId: string,
    role: string,
    filter?: OrderFilterInput,
    limit = 20,
    offset = 0,
  ) {
    const page = Math.max(1, Math.floor(offset / limit) + 1);
    const where: Prisma.OrderWhereInput = {};

    if (role === 'CLIENT') {
      where.userId = userId;
    } else if (role === 'DELIVERY_PERSON') {
      where.deliveryPersonId = userId;
      where.status = OrderStatus.SHIPPED;
    }

    if (filter) {
      if (filter.status) where.status = filter.status;
      if (filter.fromDate || filter.toDate) {
        where.createdAt = {
          ...(filter.fromDate && { gte: filter.fromDate }),
          ...(filter.toDate && { lte: filter.toDate }),
        };
      }
      if (filter.minAmount || filter.maxAmount) {
        where.totalAmount = {
          ...(filter.minAmount && { gte: filter.minAmount }),
          ...(filter.maxAmount && { lte: filter.maxAmount }),
        };
      }
    }

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((order) => ({
        ...order,
        promoCode: (order.promoSnapshot as any)?.code ?? null,
        shippingAddress: order.shippingAddressSnapshot,
      })),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
