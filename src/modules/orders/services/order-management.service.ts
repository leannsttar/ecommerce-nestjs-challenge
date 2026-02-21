import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus } from '../entities/order.entity';

@Injectable()
export class OrderManagementService {
  private readonly logger = new Logger(OrderManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cancelOrder(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (role === 'CLIENT' && order.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own orders.');
    }

    if (
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Cannot cancel an order that has already been shipped or delivered.',
      );
    }

    const cancelled = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    return {
      ...cancelled,
      promoCode: (cancelled.promoSnapshot as any)?.code ?? null,
      shippingAddress: cancelled.shippingAddressSnapshot,
    };
  }

  async assignOrdersToDelivery(
    orderIds: string[],
    deliveryPersonId: string,
  ): Promise<{ count: number }> {
    const deliveryPerson = await this.prisma.user.findUnique({
      where: { id: deliveryPersonId },
      select: { id: true, role: true },
    });

    if (!deliveryPerson)
      throw new NotFoundException(`User ${deliveryPersonId} not found.`);
    if (deliveryPerson.role !== 'DELIVERY_PERSON') {
      throw new BadRequestException(
        `User ${deliveryPersonId} is not a delivery person.`,
      );
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });

    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = orderIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Order(s) not found: ${missing.join(', ')}`);
    }

    const notPaid = orders.filter((o) => o.status !== OrderStatus.PAID);
    if (notPaid.length > 0) {
      throw new BadRequestException(
        `Only PAID orders can be assigned. These orders are not PAID: ${notPaid.map((o) => o.id).join(', ')}`,
      );
    }

    const result = await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { deliveryPersonId, status: OrderStatus.PROCESSING },
    });

    this.logger.log(
      `Manager assigned ${result.count} order(s) to delivery person ${deliveryPersonId}.`,
    );

    return { count: result.count };
  }

  async dispatchOrders(orderIds: string[]): Promise<{ count: number }> {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });

    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = orderIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Order(s) not found: ${missing.join(', ')}`);
    }

    const notProcessing = orders.filter(
      (o) => o.status !== OrderStatus.PROCESSING,
    );
    if (notProcessing.length > 0) {
      throw new BadRequestException(
        `Only PROCESSING orders can be dispatched. These are not in PROCESSING state: ${notProcessing.map((o) => o.id).join(', ')}`,
      );
    }

    const result = await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: OrderStatus.SHIPPED },
    });

    this.logger.log(
      `Manager dispatched ${result.count} order(s) to SHIPPED status.`,
    );

    return { count: result.count };
  }

  async markAsDelivered(orderId: string, deliveryPersonId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException(
        `Only SHIPPED orders can be marked as delivered. Current status: ${order.status}`,
      );
    }

    if (order.deliveryPersonId !== deliveryPersonId) {
      throw new ForbiddenException(
        'You can only mark your own assigned orders as delivered.',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED },
    });

    this.logger.log(
      `Delivery person ${deliveryPersonId} marked order ${orderId} as DELIVERED.`,
    );

    return {
      ...updated,
      promoCode: (updated.promoSnapshot as any)?.code ?? null,
      shippingAddress: updated.shippingAddressSnapshot,
    };
  }
}
