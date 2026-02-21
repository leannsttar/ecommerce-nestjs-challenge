import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { StockNotificationProcessor } from './processors/stock-notification.processor';

@Module({
  providers: [EmailService, StockNotificationProcessor],
  exports: [EmailService],
})
export class NotificationsModule {}
