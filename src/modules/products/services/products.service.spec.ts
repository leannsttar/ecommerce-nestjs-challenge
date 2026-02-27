import { NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ProductsService } from './products.service';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const PRODUCT_ID = 'product-uuid-1';
const CATEGORY_ID = 'category-uuid-1';

const mockProduct: Product = {
  id: PRODUCT_ID,
  name: 'Test Product',
  description: 'A test product',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

// ─── ProductsService ──────────────────────────────────────────────────────────

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProductsService(prisma);
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('excludes inactive products by default and returns correct pagination metadata', async () => {
      // 25 total items, page size 10, offset 0 → page 1 of 3, hasNextPage=true
      prisma.$transaction.mockResolvedValue([[mockProduct], 25]);

      const actual = await service.findAll(10, 0);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, deletedAt: null }),
        }),
      );
      expect(actual.totalItems).toBe(25);
      expect(actual.totalPages).toBe(3);
      expect(actual.hasNextPage).toBe(true);
      expect(actual.hasPreviousPage).toBe(false);
    });

    it('includes inactive products when the flag is set', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll(10, 0, undefined, true);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, isActive: undefined },
        }),
      );
    });

    it('applies a category constraint when categoryId is provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll(10, 0, CATEGORY_ID);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categories: { some: { categoryId: CATEGORY_ID } },
          }),
        }),
      );
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when the product does not exist or is soft-deleted', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      // Execute the transaction callback immediately using the mock as the tx client
      (prisma.$transaction as jest.Mock).mockImplementation(
        (fn: (tx: DeepMockProxy<PrismaService>) => Promise<Product>) => fn(prisma),
      );
      prisma.product.create.mockResolvedValue(mockProduct);
    });

    it('deduplicates images — removes featuredImage from gallery when it appears in both arrays', async () => {
      await service.create({
        name: 'Product',
        description: 'Desc',
        categoryIds: [CATEGORY_ID],
        options: [],
        featuredImage: 'featured.jpg',
        images: ['featured.jpg', 'gallery.jpg'], // featured.jpg would be duplicated without dedup
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: {
              create: [
                { url: 'featured.jpg', isMain: true },
                { url: 'gallery.jpg', isMain: false },
              ],
            },
          }),
        }),
      );
    });

    it('creates a product option for each option in the input', async () => {
      await service.create({
        name: 'Product',
        description: 'Desc',
        categoryIds: [CATEGORY_ID],
        featuredImage: 'featured.jpg',
        options: [
          { name: 'Color', values: ['Red', 'Blue'] },
          { name: 'Size', values: ['S', 'M'] },
        ],
      });

      expect(prisma.productOption.create).toHaveBeenCalledTimes(2);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('replaces all existing categories when categoryIds is provided', async () => {
      const newCategoryId = 'category-uuid-2';
      prisma.product.update.mockResolvedValue(mockProduct);

      await service.update(PRODUCT_ID, { categoryIds: [newCategoryId] });

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: {
              deleteMany: {},
              create: [{ category: { connect: { id: newCategoryId } } }],
            },
          }),
        }),
      );
    });

    it('leaves categories unchanged when categoryIds is not provided', async () => {
      prisma.product.update.mockResolvedValue(mockProduct);

      await service.update(PRODUCT_ID, { name: 'Updated Name' });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { name: 'Updated Name', categories: undefined },
      });
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.remove(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('soft-deletes by stamping deletedAt instead of destroying the record', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({ ...mockProduct, deletedAt: new Date() });

      await service.remove(PRODUCT_ID);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ─── disable ────────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.disable(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('sets isActive to false without soft-deleting the product', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({ ...mockProduct, isActive: false });

      await service.disable(PRODUCT_ID);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { isActive: false },
      });
    });
  });
});
