import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/pagination/paginated.type';
import { Order } from './order.entity';

@ObjectType()
export class PaginatedOrders extends Paginated(Order) {}
