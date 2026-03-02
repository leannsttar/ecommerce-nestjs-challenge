import { Category } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const CATEGORY_ID = 'category-uuid-1';

const mockCategory: Category = {
  id: CATEGORY_ID,
  name: 'Electronics',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

// ─── CategoriesService ────────────────────────────────────────────────────────

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new CategoriesService(prisma);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns only active categories by filtering out soft-deleted records', async () => {
      const mockCategories = [mockCategory];
      prisma.category.findMany.mockResolvedValue(mockCategories);

      const actual = await service.findAll();

      expect(actual).toEqual(mockCategories);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it('returns an empty array when no active categories exist', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const actual = await service.findAll();

      expect(actual).toEqual([]);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('persists the new category with the provided input data', async () => {
      const input = { name: 'Electronics' };
      prisma.category.create.mockResolvedValue(mockCategory);

      const actual = await service.create(input);

      expect(actual).toEqual(mockCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({ data: input });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the correct category with the provided fields', async () => {
      const input = { name: 'Updated Electronics' };
      const updatedCategory: Category = { ...mockCategory, name: input.name };
      prisma.category.update.mockResolvedValue(updatedCategory);

      const actual = await service.update(CATEGORY_ID, input);

      expect(actual).toEqual(updatedCategory);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: input,
      });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes the category by stamping deletedAt instead of destroying the record', async () => {
      const deletedCategory: Category = {
        ...mockCategory,
        deletedAt: new Date(),
      };
      prisma.category.update.mockResolvedValue(deletedCategory);

      const actual = await service.remove(CATEGORY_ID);

      expect(actual.deletedAt).not.toBeNull();
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
