import { Controller, Post, Body, UseGuards, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signUp(@Body() dto: SignUpDto, @Res({passthrough: true}) res: Response): Promise<AuthResponseDto> {
    const result = await this.authService.signUp(dto);
    this.setCookie(res, result.refreshToken, result.refreshTokenExpirationMs);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('signin')
  async signIn(@Body() dto: SignInDto, @Res({passthrough: true}) res: Response): Promise<AuthResponseDto> {
    const result = await this.authService.signIn(dto);
    this.setCookie(res, result.refreshToken, result.refreshTokenExpirationMs);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request): Promise<{ accessToken: string; expiresIn: number }> {
    const refreshToken = req.cookies['refreshToken'];
    return this.authService.refresh(refreshToken);
  }

  @Post('signout')
  // @UseGuards(JwtAuthGuard)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ message: string }> {
    const refreshToken = req.cookies['refreshToken'];
    await this.authService.signOut(refreshToken);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
    return { message: 'Signed out successfully' };
  }

  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  private setCookie(res: Response, token: string, maxAge: number) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAge,
    });
  }
}
