import {
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CartItem,
  Order,
  Payment,
  ProductVariant,
  PromoCode,
  User,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import { CheckoutInput } from '../dto/checkout.input';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../entities/order.entity';
import { PromoType } from '../../promo/entities/promo-code.entity';
import { OrderCheckoutService } from './order-checkout.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const ORDER_ID = 'order-uuid-1';
const VARIANT_ID = 'variant-uuid-1';
const PROMO_ID = 'promo-uuid-1';
const PAYMENT_INTENT_ID = 'pi_test_1';
const CLIENT_SECRET = 'pi_test_1_secret_abc';

const mockInput: CheckoutInput = {
  shippingAddress: {
    addressLine: '123 Main St',
    city: 'Austin',
    country: 'US',
    postalCode: '78701',
  },
  currency: 'usd',
};

// A standard in-stock cart item (price=1000, qty=2 → line total=2000)
const mockCartItem = {
  userId: USER_ID,
  productVariantId: VARIANT_ID,
  quantity: 2,
  productVariant: {
    id: VARIANT_ID,
    price: 1000,
    sku: 'SKU-001',
    stockQuantity: 10,
    product: { name: 'Test Product' },
  },
} as unknown as CartItem & {
  productVariant: {
    price: number;
    sku: string;
    stockQuantity: number;
    product: { name: string };
  };
};

// Fresh variant as returned inside the transaction stock check
const mockFreshVariant = { id: VARIANT_ID, stockQuantity: 10, sku: 'SKU-001' };

const mockUser = { id: USER_ID, stripeCustomerId: null } as User;

const mockOrder = { id: ORDER_ID, items: [] } as Order & {
  items: [];
};
const mockPayment = { id: 'payment-uuid-1' } as Payment;

const mockPaymentIntent = {
  id: PAYMENT_INTENT_ID,
  client_secret: CLIENT_SECRET,
} as Stripe.PaymentIntent;

//active promo code (PERCENTAGE, 10%, no caps)
const mockPromo: PromoCode = {
  id: PROMO_ID,
  code: 'SAVE10',
  type: PromoType.PERCENTAGE as PromoCode['type'],
  value: 10,
  isActive: true,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
  usageCount: 0,
  usageLimit: 100,
  minPurchase: null,
  maxDiscountAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── OrderCheckoutService ─────────────────────────────────────────────────────

describe('OrderCheckoutService', () => {
  let service: OrderCheckoutService;
  let prisma: DeepMockProxy<PrismaService>;
  let stripe: DeepMocked<StripeService>;
  let stockQueue: DeepMocked<Queue>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    stripe = createMock<StripeService>();
    stockQueue = createMock<Queue>();
    service = new OrderCheckoutService(prisma, stripe, stockQueue);

    // Execute the $transaction callback immediately using `prisma` as the tx client
    (prisma.$transaction as jest.Mock).mockImplementation(
      (fn: (tx: DeepMockProxy<PrismaService>) => Promise<unknown>) =>
        fn(prisma),
    );

    // Shared happy-path defaults — individual tests override as needed
    prisma.cartItem.findMany.mockResolvedValue([mockCartItem]);
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.productVariant.findMany.mockResolvedValue([
      mockFreshVariant,
    ] as ProductVariant[]);
    prisma.productVariant.update.mockResolvedValue({
      ...mockFreshVariant,
      stockQuantity: 8,
    } as ProductVariant);
    prisma.order.create.mockResolvedValue(mockOrder);
    prisma.payment.create.mockResolvedValue(mockPayment);
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    stripe.createPaymentIntent.mockResolvedValue(
      mockPaymentIntent as Stripe.Response<Stripe.PaymentIntent>,
    );
    stripe.updatePaymentIntentMetadata.mockResolvedValue(
      {} as Stripe.Response<Stripe.PaymentIntent>,
    );
  });

  // ─── Cart validation ────────────────────────────────────────────────────────

  describe('checkout — cart validation', () => {
    it('should throw BadRequestException when the cart is empty', async () => {
      prisma.cartItem.findMany.mockResolvedValue([]);

      await expect(service.checkout(USER_ID, mockInput)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Promo code validation ──────────────────────────────────────────────────

  describe('checkout — promo code validation', () => {
    it('should throw BadRequestException when the promo code does not exist', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(null);

      await expect(
        service.checkout(USER_ID, { ...mockInput, promoCode: 'GHOST' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnprocessableEntityException when the promo code is inactive', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...mockPromo,
        isActive: false,
      });

      await expect(
        service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when the promo code is expired', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...mockPromo,
        expiresAt: new Date(Date.now() - 1), // yesterday
      });

      await expect(
        service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when the promo code has reached its usage limit', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...mockPromo,
        usageCount: 100,
        usageLimit: 100,
      });

      await expect(
        service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when the subtotal is below the promo minPurchase', async () => {
      // Cart subtotal = 2000 cents. minPurchase = 5000 cents → below threshold
      prisma.promoCode.findUnique.mockResolvedValue({
        ...mockPromo,
        minPurchase: 5000,
      });

      await expect(
        service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ─── Promo discount math ────────────────────────────────────────────────────

  describe('checkout — promo discount calculation', () => {
    it('should apply a PERCENTAGE discount capped by maxDiscountAmount', async () => {
      // subtotal=2000, 10% would be 200, but cap is 150 → discount=150, total=1850
      prisma.promoCode.findUnique.mockResolvedValue({
        ...mockPromo,
        type: 'PERCENTAGE',
        value: 10,
        maxDiscountAmount: 150,
      });

      await service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 2000,
            discountAmount: 150,
            totalAmount: 1850,
          }),
        }),
      );
    });

    it('should apply a FIXED_AMOUNT discount without exceeding the subtotal', async () => {
      // subtotal=2000, fixed discount=500 → total=1500
      prisma.promoCode.findUnique.mockResolvedValue({
        ...mockPromo,
        type: 'FIXED_AMOUNT',
        value: 500,
        maxDiscountAmount: null,
      });

      await service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 500,
            totalAmount: 1500,
          }),
        }),
      );
    });
  });

  // ─── Stock check ────────────────────────────────────────────────────────────

  describe('checkout — stock validation', () => {
    it('should throw UnprocessableEntityException when a cart item exceeds available stock', async () => {
      // quantity=2 but only 1 in stock — valid request, state conflict at fulfillment time
      prisma.productVariant.findMany.mockResolvedValue([
        { id: VARIANT_ID, stockQuantity: 1, sku: 'SKU-001' },
      ] as ProductVariant[]);

      await expect(service.checkout(USER_ID, mockInput)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ─── Stripe failure handling ─────────────────────────────────────────────────

  describe('checkout — Stripe failure handling', () => {
    it('should throw InternalServerErrorException when Stripe PI creation fails', async () => {
      stripe.createPaymentIntent.mockRejectedValue(new Error('Stripe down'));

      await expect(service.checkout(USER_ID, mockInput)).rejects.toThrow(
        InternalServerErrorException,
      );
      // PI never created — nothing to cancel
      expect(stripe.cancelPaymentIntent).not.toHaveBeenCalled();
    });

    it('should attempt to cancel the Stripe PI when the DB transaction fails after PI creation', async () => {
      const dbError = new UnprocessableEntityException(
        'Insufficient stock for variant(s): SKU-001',
      );
      // PI created successfully, but transaction throws
      (prisma.$transaction as jest.Mock).mockRejectedValue(dbError);

      await expect(service.checkout(USER_ID, mockInput)).rejects.toThrow(
        dbError,
      );

      expect(stripe.cancelPaymentIntent).toHaveBeenCalledWith(
        PAYMENT_INTENT_ID,
      );
    });
  });

  // ─── Happy path & side effects ───────────────────────────────────────────────

  describe('checkout — happy path', () => {
    it('should create a PENDING order, clear the cart, record a PENDING payment, and return clientSecret + orderId', async () => {
      const result = await service.checkout(USER_ID, mockInput);

      // Order created with correct amounts and PENDING status
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            status: OrderStatus.PENDING,
            subtotal: 2000,
            totalAmount: 2000,
            discountAmount: 0,
          }),
        }),
      );
      // Cart cleared for this user
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      // Payment record created with PENDING status and linked to the PI
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: ORDER_ID,
            stripePaymentIntentId: PAYMENT_INTENT_ID,
            paymentMethod: PaymentMethod.PAYMENT_INTENT,
            status: PaymentStatus.PENDING,
            amount: 2000,
          }),
        }),
      );
      // Returns what the client needs to confirm payment on the frontend
      expect(result).toEqual({
        clientSecret: CLIENT_SECRET,
        orderId: ORDER_ID,
        amount: 2000,
      });
    });

    it('should increment the promo usageCount inside the transaction when a promo code is applied', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(mockPromo);

      await service.checkout(USER_ID, { ...mockInput, promoCode: 'SAVE10' });

      expect(prisma.promoCode.update).toHaveBeenCalledWith({
        where: { id: PROMO_ID },
        data: { usageCount: { increment: 1 } },
      });
    });

    it('should enqueue a low-stock notification when stock drops to exactly 3 after decrement', async () => {
      // Pre-decrement stock=5, post-decrement=3 → notification threshold hit
      prisma.productVariant.update.mockResolvedValue({
        id: VARIANT_ID,
        stockQuantity: 3,
      } as ProductVariant);

      await service.checkout(USER_ID, mockInput);

      expect(stockQueue.add).toHaveBeenCalledWith('notify', {
        variantId: VARIANT_ID,
      });
    });

    it('should NOT enqueue a low-stock notification when post-decrement stock is above the threshold', async () => {
      // stock goes from 10 to 8 → no notification
      prisma.productVariant.update.mockResolvedValue({
        id: VARIANT_ID,
        stockQuantity: 8,
      } as ProductVariant);

      await service.checkout(USER_ID, mockInput);

      expect(stockQueue.add).not.toHaveBeenCalled();
    });
  });
});
