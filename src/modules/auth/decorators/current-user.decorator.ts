import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { getRequestFromContext } from '../../../utils/context.utils';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getRequestFromContext(ctx);
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  },
);
