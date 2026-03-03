import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/pagination/paginated.type';
import { Product } from './product.entity';

@ObjectType()
export class PaginatedProducts extends Paginated(Product) {}
