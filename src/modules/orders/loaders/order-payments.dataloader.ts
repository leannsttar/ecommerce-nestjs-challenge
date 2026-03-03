import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class OrderPaymentsDataLoader extends DataLoader<string, Payment[]> {
  constructor(private readonly prisma: PrismaService) {
    super(async (orderIds: readonly string[]) => {
      const allPayments = await this.prisma.payment.findMany({
        where: { orderId: { in: [...orderIds] } },
      });

      const paymentsByOrderId = new Map<string, Payment[]>();
      for (const payment of allPayments) {
        if (!paymentsByOrderId.has(payment.orderId)) {
          paymentsByOrderId.set(payment.orderId, []);
        }
        paymentsByOrderId.get(payment.orderId)!.push(payment as Payment);
      }

      return orderIds.map((id) => paymentsByOrderId.get(id) || []);
    });
  }
}
