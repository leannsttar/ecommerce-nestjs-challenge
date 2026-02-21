import { Module } from '@nestjs/common';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';
import { CaslModule } from '../../common/casl/casl.module';

@Module({
  imports: [CaslModule],
  providers: [CartResolver, CartService],
  exports: [CartService],
})
export class CartModule {}
