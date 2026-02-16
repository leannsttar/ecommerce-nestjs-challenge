import { ObjectType } from '@nestjs/graphql';
import { ProductBase } from './product-base.interface';

@ObjectType({ implements: () => [ProductBase] })
export class Product extends ProductBase {}
