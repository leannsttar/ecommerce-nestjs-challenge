import { Favorite } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const VARIANT_ID = 'variant-uuid-1';
const FAVORITE_ID = 'favorite-uuid-1';

const mockFavorite: Favorite = {
  id: FAVORITE_ID,
  userId: USER_ID,
  variantId: VARIANT_ID,
  createdAt: new Date('2024-01-01'),
};

// ─── FavoritesService ─────────────────────────────────────────────────────────

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new FavoritesService(prisma);
  });

  // ─── toggle ────────────────────────────────────────────────────────────────

  describe('toggle', () => {
    it('removes the favorite and returns false when the variant is already liked by the user', async () => {
      prisma.favorite.findUnique.mockResolvedValue(mockFavorite);
      prisma.favorite.delete.mockResolvedValue(mockFavorite);

      const actual = await service.toggle(USER_ID, VARIANT_ID);

      expect(actual).toBe(false);
      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: FAVORITE_ID },
      });
      expect(prisma.favorite.create).not.toHaveBeenCalled();
    });

    it('creates the favorite and returns true when the variant has not yet been liked by the user', async () => {
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.create.mockResolvedValue(mockFavorite);

      const actual = await service.toggle(USER_ID, VARIANT_ID);

      expect(actual).toBe(true);
      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, variantId: VARIANT_ID },
      });
      expect(prisma.favorite.delete).not.toHaveBeenCalled();
    });

    it('looks up the existing record using the composite unique key', async () => {
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.create.mockResolvedValue(mockFavorite);

      await service.toggle(USER_ID, VARIANT_ID);

      expect(prisma.favorite.findUnique).toHaveBeenCalledWith({
        where: { userId_variantId: { userId: USER_ID, variantId: VARIANT_ID } },
      });
    });

    it('deletes by the record primary key, not the composite key', async () => {
      // Ensures the delete targets the resolved record's id, guarding against
      // accidental re-use of the composite key on the delete call.
      const favoriteWithDifferentId: Favorite = { ...mockFavorite, id: 'other-uuid' };
      prisma.favorite.findUnique.mockResolvedValue(favoriteWithDifferentId);
      prisma.favorite.delete.mockResolvedValue(favoriteWithDifferentId);

      await service.toggle(USER_ID, VARIANT_ID);

      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: 'other-uuid' },
      });
    });
  });

  // ─── findAllForUser ────────────────────────────────────────────────────────

  describe('findAllForUser', () => {
    it('returns favorites for the given user with their variants, ordered newest first', async () => {
      const mockFavorites = [mockFavorite];
      prisma.favorite.findMany.mockResolvedValue(mockFavorites);

      const actual = await service.findAllForUser(USER_ID);

      expect(actual).toEqual(mockFavorites);
      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        include: { variant: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns an empty array when the user has no favorites', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);

      const actual = await service.findAllForUser(USER_ID);

      expect(actual).toEqual([]);
    });
  });
});
