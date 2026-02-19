import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../casl-ability.factory';
import {
  CHECK_ABILITIES_KEY,
  RequiredRule,
} from '../decorators/check-abilities.decorator';
import { ForbiddenError } from '@casl/ability';
import { getRequestFromContext } from '../../../utils/context.utils';

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // read rules attached by @CheckAbilities()
    const rules =
      this.reflector.get<RequiredRule[]>(
        CHECK_ABILITIES_KEY,
        context.getHandler(),
      ) || [];

    // If no rules, allow access
    if (rules.length === 0) {
      return true;
    }

    const user = this.getUser(context);

    if (!user) {
      throw new ForbiddenException('No authenticated user found.');
    }

    const ability = this.caslAbilityFactory.defineAbility(user);

    try {
      //check if user can access
      for (const rule of rules) {
        if (!ability.can(rule.action, rule.subject)) {
          throw new ForbiddenException(
            'You do not have permission to perform this action.',
          );
        }
      }

      // if all rules pass, allow access
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  private getUser(context: ExecutionContext) {
    const request = getRequestFromContext(context);
    return request.user;
  }
}
