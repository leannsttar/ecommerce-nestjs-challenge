import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { AuthResult } from '../types/auth-result.type';

//interceptor will:
// - extract the refresh token data from the response
// - set it as a secure HTTP-only cookie
// - remove it from the JSON response body (only return accessToken and expiresIn)

@Injectable()
export class SetRefreshTokenInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // check if contains refresh token information
        if (
          data &&
          typeof data === 'object' &&
          'refreshToken' in data &&
          'refreshTokenExpirationMs' in data
        ) {
          const authResult = data as AuthResult;
          const response = context.switchToHttp().getResponse<Response>();

          // set refresh token as an http-only cookie
          response.cookie('refreshToken', authResult.refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: authResult.refreshTokenExpirationMs,
          });

          // return only access token info
          return {
            accessToken: authResult.accessToken,
            expiresIn: authResult.expiresIn,
          };
        }

        // if not an AuthResult, return data unchanged
        return data;
      }),
    );
  }
}
