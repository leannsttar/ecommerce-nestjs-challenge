import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from '../casl-ability.factory';

export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

export const CHECK_ABILITIES_KEY = 'check_abilities';

//example: @CheckAbilities({ action: Action.Create, subject: Product })
export const CheckAbilities = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITIES_KEY, requirements);
