import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrderItemsDataLoader extends DataLoader<string, any[]> {
  constructor(private readonly prisma: PrismaService) {
    super(async (orderIds: readonly string[]) => {
      const allItems = await this.prisma.orderItem.findMany({
        where: { orderId: { in: [...orderIds] } },
      });

      const itemsByOrderId = new Map<string, any[]>();
      for (const item of allItems) {
        if (!itemsByOrderId.has(item.orderId)) {
          itemsByOrderId.set(item.orderId, []);
        }

        const mappedItem = {
          ...item,
          price: item.unitPriceAtPurchase,
          total: item.totalPrice,
          productTitle: item.productSnapshot?.['productName'] ?? '',
          variantTitle: item.productSnapshot?.['sku'] ?? '',
        };

        itemsByOrderId.get(item.orderId)!.push(mappedItem);
      }

      return orderIds.map((id) => itemsByOrderId.get(id) || []);
    });
  }
}
