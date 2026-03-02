import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CartItem, ProductVariant } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';
const VARIANT_ID = 'variant-uuid-1';
const CART_ITEM_ID = 'cart-item-uuid-1';

const mockVariant: ProductVariant = {
  id: VARIANT_ID,
  productId: 'product-uuid-1',
  sku: 'SKU-001',
  price: 1000,
  stockQuantity: 10,
  image: null,
  isActive: true,
  stripeProductId: null,
  stripePriceId: null,
  stripePaymentLinkId: null,
  paymentLinkUrl: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

const mockCartItem: CartItem = {
  id: CART_ITEM_ID,
  userId: USER_ID,
  productVariantId: VARIANT_ID,
  quantity: 2,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// CartItem with its productVariant relation included (Prisma include result)
type CartItemWithVariant = CartItem & { productVariant: ProductVariant };

const mockCartItemWithVariant: CartItemWithVariant = {
  ...mockCartItem,
  productVariant: mockVariant,
};

// ─── CartService ──────────────────────────────────────────────────────────────

describe('CartService', () => {
  let service: CartService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new CartService(prisma);
  });

  // ─── getCart ────────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('computes per-item subtotal as quantity × price', async () => {
      const item = { ...mockCartItemWithVariant, quantity: 3 };
      prisma.cartItem.findMany.mockResolvedValue([
        item,
      ] as unknown as CartItem[]);

      const actual = await service.getCart(USER_ID);

      // price=1000, quantity=3 → subtotal must be 3000
      expect(actual.items[0].subtotal).toBe(3000);
    });

    it('aggregates totalQuantity and subtotal correctly across multiple items', async () => {
      const item1 = { ...mockCartItemWithVariant, quantity: 2 }; // 2 × 1000 = 2000
      const item2: CartItemWithVariant = {
        ...mockCartItem,
        id: 'cart-item-uuid-2',
        productVariantId: 'variant-uuid-2',
        quantity: 4,
        productVariant: { ...mockVariant, id: 'variant-uuid-2', price: 500 }, // 4 × 500 = 2000
      };
      prisma.cartItem.findMany.mockResolvedValue([
        item1,
        item2,
      ] as unknown as CartItem[]);

      const actual = await service.getCart(USER_ID);

      expect(actual.totalQuantity).toBe(6);
      expect(actual.subtotal).toBe(4000);
    });
  });

  // ─── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('throws NotFoundException when the product variant does not exist or is unavailable', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when the cumulative quantity (existing + new) would exceed stock', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant); // stock: 10
      prisma.cartItem.findUnique.mockResolvedValue(mockCartItem); // existing qty: 2

      // 2 + 9 = 11, exceeds stock of 10
      await expect(
        service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 9 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('upserts with increment when the variant already exists in the cart', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant); // stock: 10
      prisma.cartItem.findUnique.mockResolvedValue(mockCartItem); // existing qty: 2, adding 3 = 5 ≤ 10
      prisma.cartItem.upsert.mockResolvedValue(mockCartItem);
      prisma.cartItem.findMany.mockResolvedValue([]);

      await service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 3 });

      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: {
          userId_productVariantId: {
            userId: USER_ID,
            productVariantId: VARIANT_ID,
          },
        },
        update: { quantity: { increment: 3 } },
        create: { userId: USER_ID, productVariantId: VARIANT_ID, quantity: 3 },
      });
    });

    it('upserts with create data when the variant is not yet in the cart', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant); // stock: 10
      prisma.cartItem.findUnique.mockResolvedValue(null);
      prisma.cartItem.upsert.mockResolvedValue(mockCartItem);
      prisma.cartItem.findMany.mockResolvedValue([]);

      await service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 });

      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: {
          userId_productVariantId: {
            userId: USER_ID,
            productVariantId: VARIANT_ID,
          },
        },
        update: { quantity: { increment: 1 } },
        create: { userId: USER_ID, productVariantId: VARIANT_ID, quantity: 1 },
      });
    });
  });

  // ─── updateItemQuantity ─────────────────────────────────────────────────────

  describe('updateItemQuantity', () => {
    it('throws NotFoundException when the cart item does not exist', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItemQuantity(USER_ID, CART_ITEM_ID, { quantity: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the cart item belongs to a different user', async () => {
      const otherUsersItem: CartItemWithVariant = {
        ...mockCartItemWithVariant,
        userId: OTHER_USER_ID,
      };
      prisma.cartItem.findUnique.mockResolvedValue(
        otherUsersItem as unknown as CartItem,
      );

      await expect(
        service.updateItemQuantity(USER_ID, CART_ITEM_ID, { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when the new quantity exceeds available stock', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(
        mockCartItemWithVariant as unknown as CartItem,
      ); // stock: 10

      await expect(
        service.updateItemQuantity(USER_ID, CART_ITEM_ID, { quantity: 11 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('updates the cart item with the exact new quantity', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(
        mockCartItemWithVariant as unknown as CartItem,
      );
      prisma.cartItem.update.mockResolvedValue({
        ...mockCartItem,
        quantity: 5,
      });
      prisma.cartItem.findMany.mockResolvedValue([]);

      await service.updateItemQuantity(USER_ID, CART_ITEM_ID, { quantity: 5 });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: CART_ITEM_ID },
        data: { quantity: 5 },
      });
    });
  });

  // ─── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('throws NotFoundException when no cart item matches the given id and user', async () => {
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeItem(USER_ID, CART_ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces ownership by scoping the delete to both the item id and the userId', async () => {
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.cartItem.findMany.mockResolvedValue([]);

      await service.removeItem(USER_ID, CART_ITEM_ID);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { id: CART_ITEM_ID, userId: USER_ID },
      });
    });
  });

  // ─── clearCart ──────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('deletes all items for the user and returns an empty cart without re-querying', async () => {
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });

      const actual = await service.clearCart(USER_ID);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(actual).toEqual({
        id: USER_ID,
        items: [],
        totalQuantity: 0,
        subtotal: 0,
      });
      // clearCart knows the result is empty — no need to re-fetch
      expect(prisma.cartItem.findMany).not.toHaveBeenCalled();
    });
  });
});
