import { NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

const mockUser: User = {
  id: USER_ID,
  email: 'alice@example.com',
  role: UserRole.CLIENT,
  passwordHash: 'stored-hash',
  fullName: 'Alice',
  stripeCustomerId: null,
  resetPasswordTokenHash: null,
  resetPasswordExpires: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

// ─── UsersService ─────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new UsersService(prisma);
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const actual = await service.findById(USER_ID);

      expect(actual).toEqual(mockUser);
    });

    it('throws NotFoundException when no user matches the given id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById(USER_ID)).rejects.toThrow(
        new NotFoundException(`User #${USER_ID} not found`),
      );
    });
  });

  // ─── updatePasswordAndClearResetToken ──────────────────────────────────────

  describe('updatePasswordAndClearResetToken', () => {
    it('nulls out the reset token and expiry atomically with the password update', async () => {
      const newHash = 'new-password-hash';
      prisma.user.update.mockResolvedValue(mockUser);

      await service.updatePasswordAndClearResetToken(USER_ID, newHash);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          passwordHash: newHash,
          resetPasswordTokenHash: null,
          resetPasswordExpires: null,
        },
      });
    });
  });

  // ─── findByResetToken ──────────────────────────────────────────────────────

  describe('findByResetToken', () => {
    it('filters by token hash and enforces that the token has not expired', async () => {
      const tokenHash = 'hashed-reset-token';
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await service.findByResetToken(tokenHash);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpires: { gt: expect.any(Date) },
        },
      });
    });
  });
});
