import { Controller, Post, Body, Res, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { GetRefreshToken } from './decorators/get-refresh-token.decorator';
import { SetRefreshTokenInterceptor } from './interceptors/set-refresh-token.interceptor';
import { ClearRefreshToken } from './decorators/clear-refresh-token.decorator';

@Controller('auth')
@UseInterceptors(SetRefreshTokenInterceptor) // sets refresh token as cookie for signup, signin & refresh routes
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
    return this.authService.signUp(dto);
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('signin')
  async signIn(@Body() dto: SignInDto): Promise<AuthResponseDto> {
    return this.authService.signIn(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@GetRefreshToken() refreshToken: string): Promise<AuthResponseDto> {
    return this.authService.refresh(refreshToken);
  }

  @Post('signout')
  @ClearRefreshToken()
  async signOut(@GetRefreshToken() refreshToken: string): Promise<{ message: string }> {
    await this.authService.signOut(refreshToken);
    return { message: 'Signed out successfully' };
  }
 
  @Public()
  @Throttle({ short: { limit: 3, ttl: 900000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Throttle({ short: { limit: 3, ttl: 900000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully. Please log in with your new password.,' };
  }
}
