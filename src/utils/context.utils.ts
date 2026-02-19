import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

//Retrieves the Request object
export function getRequestFromContext(context: ExecutionContext) {
  // ttry GraphQL context
  const gqlCtx = GqlExecutionContext.create(context);
  const gqlReq = gqlCtx.getContext()?.req;
  if (gqlReq) {
    return gqlReq;
  }

  // allback to HTTP context
  return context.switchToHttp().getRequest();
}
