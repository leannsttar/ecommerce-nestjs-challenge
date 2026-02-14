import { UseInterceptors } from "@nestjs/common";
import { ClearRefreshTokenInterceptor } from "../interceptors/clear-refresh-token.interceptor";

export const ClearRefreshToken = () => UseInterceptors(ClearRefreshTokenInterceptor);