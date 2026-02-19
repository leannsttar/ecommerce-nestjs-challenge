import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  InferSubjects,
  ExtractSubjectType,
  Subject,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Product } from 'src/modules/products/entities/product.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Variant } from 'src/modules/products/entities/variants/variant.entity';

export enum Action {
  Manage = 'manage', //all
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export type Subjects = InferSubjects<
  typeof Product | typeof Category | typeof Variant | 'all'
>;

//abilitie is action and resource
export type AppAbility = MongoAbility<[Action, Subjects]>;

interface AuthUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class CaslAbilityFactory {
  defineAbility(user: AuthUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === UserRole.MANAGER) {
      // manager mostly everything
      can(Action.Manage, 'all');
    } else if (user.role === UserRole.CLIENT) {
      can(Action.Read, Product);
      can(Action.Read, Category);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
