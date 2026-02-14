import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { User } from 'generated/prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<Pick<User, 'id' | 'role' | 'email' | 'fullName'>> {
    const user = await this.usersService.findById(payload.sub);

    if (user.deletedAt) {
      throw new UnauthorizedException('User account is inactive');
    }

    return {
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName
    };
  }
}
