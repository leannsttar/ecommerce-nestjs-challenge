import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

export const GetRefreshToken = createParamDecorator((data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const refreshToken = request.cookies?.['refreshToken'];
    if (!refreshToken) {
        throw new UnauthorizedException('Refresh token not found');
    }
    return refreshToken;
});