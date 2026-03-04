import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../services/email.service';
import { OrderStatus } from '../../orders/entities/order.entity';
import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { s3Config } from '../../../common/config/namespaces/s3.config';

@Processor('stock-notifications')
export class StockNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(StockNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    @Inject(s3Config.KEY)
    private readonly s3Configuration: ConfigType<typeof s3Config>,
  ) {
    super();
  }

  async process(job: Job<{ variantId: string }>) {
    this.logger.log(
      `Processing job ${job.id} for variant ${job.data.variantId}...`,
    );
    const { variantId } = job.data;

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
      },
    });

    if (!variant) {
      this.logger.warn(
        `Variant ${variantId} not found, skipping notification.`,
      );
      return;
    }

    // get target users
    const usersToNotify = await this.prisma.user.findMany({
      where: {
        favorites: { some: { variantId } },
        orders: {
          none: {
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
            items: { some: { productVariantId: variantId } },
          },
        },
      },
      select: {
        email: true,
      },
    });

    if (usersToNotify.length === 0) {
      this.logger.log(`No eligible users to notify for variant ${variantId}.`);
      return;
    }

    let productImage = variant.image || '';

    if (productImage && !productImage.startsWith('http')) {
      const bucket = this.s3Configuration.bucket;
      const region = this.s3Configuration.region;
      productImage = `https://${bucket}.s3.${region}.amazonaws.com/${productImage}`;
    }

    this.logger.log(
      `Found ${usersToNotify.length} users to notify for variant ${variantId}. Sending emails...`,
    );

    for (const user of usersToNotify) {
      try {
        await this.emailService.sendStockNotificationEmail(
          user.email,
          variant.product.name,
          productImage,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send stock notification to ${user.email}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Job ${job.id} completed. Emails sent.`);
  }
}
