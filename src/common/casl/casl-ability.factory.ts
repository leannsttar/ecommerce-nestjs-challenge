import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  InferSubjects,
  ExtractSubjectType,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Product } from 'src/modules/products/entities/product.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Variant } from 'src/modules/products/entities/variants/variant.entity';
import { PromoCode } from 'src/modules/promo/entities/promo-code.entity';
import { Favorite } from 'src/modules/favorites/entities/favorite.entity';
import {
  Order,
  Payment,
  OrderStatus,
} from 'src/modules/orders/entities/order.entity';
import { Cart } from 'src/modules/cart/entities/cart.entity';

export enum Action {
  Manage = 'manage', // all
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Apply = 'apply', // promo code
  Deliver = 'deliver', // delivery person mark as delivered
  Cancel = 'cancel', // cancel an order (client/manager only)
}

export type Subjects = InferSubjects<
  | typeof Product
  | typeof Category
  | typeof Variant
  | typeof PromoCode
  | typeof Favorite
  | typeof Order
  | typeof Payment
  | typeof Cart
  | 'all'
>;

export type AppAbility = MongoAbility<[Action, Subjects]>;

interface AuthUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class CaslAbilityFactory {
  defineAbility(user: AuthUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === UserRole.MANAGER) {
      can(Action.Manage, 'all');
    } else if (user.role === UserRole.CLIENT) {
      can(Action.Read, Category);
      can(Action.Read, Product);
      can(Action.Manage, Favorite);
      can(Action.Manage, Cart, { userId: user.id });
      can(Action.Create, Order);
      can(Action.Read, Order, { userId: user.id });
      can(Action.Cancel, Order, { userId: user.id }); // cancel own orders only
      can(Action.Apply, PromoCode);
      can(Action.Read, Payment);
    } else if (user.role === UserRole.DELIVERY_PERSON) {
      can(Action.Read, Order, {
        status: OrderStatus.SHIPPED,
        deliveryPersonId: user.id,
      });
      can(Action.Deliver, Order, {
        status: OrderStatus.SHIPPED,
        deliveryPersonId: user.id,
      });
      cannot(Action.Read, Payment);
    }
    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
