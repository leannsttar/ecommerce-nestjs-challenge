import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { Response } from 'express';

@Injectable()
export class ClearRefreshTokenInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        response.clearCookie('refreshToken', {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        });
      }),
    );
  }
}
