import { Module } from '@nestjs/common';
import { PromoResolver } from './promo.resolver';
import { PromoService } from './promo.service';
import { CaslModule } from 'src/common/casl/casl.module';

@Module({
  imports: [CaslModule],
  providers: [PromoResolver, PromoService],
  exports: [PromoService],
})
export class PromoModule {}
