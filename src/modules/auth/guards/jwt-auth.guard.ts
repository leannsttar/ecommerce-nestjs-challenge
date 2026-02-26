import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      // Always attempt to authenticate so req.user is populated if a token exists
      const canActivate = await super.canActivate(context);
      return canActivate as boolean;
    } catch (error) {
      if (isPublic) {
        return true;
      }
      throw error;
    }
  }

  getRequest(context: ExecutionContext) {
    // get graphql context
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    // if it is return request
    if (ctx?.req) {
      return ctx.req;
    }

    // if it is http normal, return standard method
    return context.switchToHttp().getRequest();
  }
}
