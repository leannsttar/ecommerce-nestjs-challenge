import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updatePasswordAndClearResetToken(
    id: string,
    newPasswordHash: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpires: null,
      },
    });
  }

  async saveResetToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: expiresAt,
      },
    });
  }

  async findByResetToken(tokenHash: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: { gt: new Date() },
      },
    });
  }
}
