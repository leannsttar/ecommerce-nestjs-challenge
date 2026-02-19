import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from '../casl-ability.factory';

// receivess user's ability and returns T or F
export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

// used to store the rules on route handlers
export const CHECK_ABILITIES_KEY = 'check_abilities';

//decorator to attach ability requirements
//example: @CheckAbilities({ action: Action.Create, subject: Product })
export const CheckAbilities = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITIES_KEY, requirements);
