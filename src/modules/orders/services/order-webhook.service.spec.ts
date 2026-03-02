import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Order, Payment, ProductVariant } from '@prisma/client';
import { Queue } from 'bullmq';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../entities/order.entity';
import { OrderWebhookService } from './order-webhook.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const ORDER_ID = 'order-uuid-1';
const SESSION_ID = 'cs_test_session_1';
const PAYMENT_INTENT_ID = 'pi_test_1';
const VARIANT_ID = 'variant-uuid-1';

// Only the fields the service reads from a PaymentIntent
const mockPaymentIntent = {
  id: PAYMENT_INTENT_ID,
  metadata: { orderId: ORDER_ID },
} as unknown as Stripe.PaymentIntent;

// Only the fields the service reads from a Checkout Session
const mockSession = {
  id: SESSION_ID,
  metadata: { variantId: VARIANT_ID },
  payment_intent: PAYMENT_INTENT_ID,
  payment_link: null,
  currency: 'usd',
  customer_details: {
    email: 'guest@example.com',
    address: {
      line1: '123 Main St',
      city: 'Austin',
      country: 'US',
      postal_code: '78701',
    },
  },
  customer_email: null,
  shipping_details: null,
  line_items: { data: [{ quantity: 2 }] },
} as unknown as Stripe.Checkout.Session;

const mockVariant = {
  id: VARIANT_ID,
  price: 1000,
  sku: 'SKU-001',
  stockQuantity: 10,
  product: { name: 'Test Product' },
} as ProductVariant & { product: { name: string } };

const mockOrder = { id: ORDER_ID } as Order;
const mockPayment = { id: 'payment-uuid-1' } as Payment;

// ─── OrderWebhookService ──────────────────────────────────────────────────────

describe('OrderWebhookService', () => {
  let service: OrderWebhookService;
  let prisma: DeepMockProxy<PrismaService>;
  let stripe: DeepMocked<StripeService>;
  let stockQueue: DeepMocked<Queue>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    stripe = createMock<StripeService>();
    stockQueue = createMock<Queue>();
    service = new OrderWebhookService(prisma, stripe, stockQueue);

    // Execute the $transaction callback immediately using `prisma` as the tx client
    (prisma.$transaction as jest.Mock).mockImplementation(
      (fn: (tx: DeepMockProxy<PrismaService>) => Promise<unknown>) =>
        fn(prisma),
    );
  });

  // ─── handlePaymentIntentSucceeded ───────────────────────────────────────────

  describe('handlePaymentIntentSucceeded', () => {
    it('should return early without any DB writes when orderId is missing from PI metadata', async () => {
      const pi = {
        ...mockPaymentIntent,
        metadata: {},
      } as unknown as Stripe.PaymentIntent;

      await service.handlePaymentIntentSucceeded(pi);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should mark the order as PAID and payment as SUCCEEDED inside a single transaction', async () => {
      // count=1 → the order was PENDING and got updated
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await service.handlePaymentIntentSucceeded(mockPaymentIntent);

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PAID },
      });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: PAYMENT_INTENT_ID },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paymentDate: expect.any(Date),
        },
      });
    });

    it('should skip the payment update when the order was already processed (count === 0)', async () => {
      // Duplicate webhook delivery — order is no longer PENDING
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await service.handlePaymentIntentSucceeded(mockPaymentIntent);

      // Must not corrupt the payment record that already has a final status
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── handlePaymentIntentFailed ──────────────────────────────────────────────

  describe('handlePaymentIntentFailed', () => {
    it('should return early without any DB writes when orderId is missing from PI metadata', async () => {
      const pi = {
        ...mockPaymentIntent,
        metadata: {},
      } as Stripe.PaymentIntent;

      await service.handlePaymentIntentFailed(pi);

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('should mark the payment record as FAILED', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await service.handlePaymentIntentFailed(mockPaymentIntent);

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: PAYMENT_INTENT_ID },
        data: { status: PaymentStatus.FAILED },
      });
    });
  });

  // ─── handleCheckoutSessionCompleted ─────────────────────────────────────────

  describe('handleCheckoutSessionCompleted', () => {
    beforeEach(() => {
      stripe.retrieveCheckoutSession.mockResolvedValue(
        mockSession as Stripe.Response<Stripe.Checkout.Session>,
      );
    });

    it('should return early without creating an order when the session was already processed', async () => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.handleCheckoutSessionCompleted(mockSession);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return early when variantId is missing from session metadata', async () => {
      const sessionWithoutVariant = {
        ...mockSession,
        metadata: {},
      } as Stripe.Checkout.Session;
      stripe.retrieveCheckoutSession.mockResolvedValue(
        sessionWithoutVariant as Stripe.Response<Stripe.Checkout.Session>,
      );
      prisma.payment.findFirst.mockResolvedValue(null);

      await service.handleCheckoutSessionCompleted(sessionWithoutVariant);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return early when the variant is not found in the database', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.productVariant.findUnique.mockResolvedValue(null);

      await service.handleCheckoutSessionCompleted(mockSession);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create order as REFUNDED and issue a Stripe refund when variant is out of stock', async () => {
      // quantity=2 requested, only 1 in stock → cannot fulfill
      const outOfStockVariant = { ...mockVariant, stockQuantity: 1 };
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.productVariant.findUnique.mockResolvedValue(outOfStockVariant);
      prisma.order.create.mockResolvedValue(mockOrder);
      prisma.payment.create.mockResolvedValue(mockPayment);
      stripe.refundPaymentIntent.mockResolvedValue(
        {} as Stripe.Response<Stripe.Refund>,
      );

      await service.handleCheckoutSessionCompleted(mockSession);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.REFUNDED }),
        }),
      );
      expect(stripe.refundPaymentIntent).toHaveBeenCalledWith(
        PAYMENT_INTENT_ID,
      );
      // Must NOT decrement stock — that would push it negative
      expect(prisma.productVariant.update).not.toHaveBeenCalled();
    });

    it('should create a PAID order, decrement stock, and record a SUCCEEDED payment for an in-stock purchase', async () => {
      // stock=10, quantity=2 → sufficient
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      prisma.order.create.mockResolvedValue(mockOrder);
      prisma.payment.create.mockResolvedValue(mockPayment);
      prisma.productVariant.update.mockResolvedValue({
        ...mockVariant,
        stockQuantity: 8, // 10 - 2
      });

      await service.handleCheckoutSessionCompleted(mockSession);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.PAID,
            totalAmount: 2000, // 1000 price * 2 quantity
          }),
        }),
      );
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.SUCCEEDED,
            paymentMethod: PaymentMethod.PAYMENT_LINK,
            amount: 2000,
          }),
        }),
      );
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
        data: { stockQuantity: { decrement: 2 } },
      });
      expect(stripe.refundPaymentIntent).not.toHaveBeenCalled();
    });

    it('should enqueue a low-stock notification when stock drops to exactly 3 after decrement', async () => {
      // stockQuantity=5, quantity=2 → post-decrement = 3 → threshold hit
      const variantWith5 = { ...mockVariant, stockQuantity: 5 };
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.productVariant.findUnique.mockResolvedValue(variantWith5);
      prisma.order.create.mockResolvedValue(mockOrder);
      prisma.payment.create.mockResolvedValue(mockPayment);
      // update() returns state AFTER the decrement
      prisma.productVariant.update.mockResolvedValue({
        ...variantWith5,
        stockQuantity: 3,
      });

      await service.handleCheckoutSessionCompleted(mockSession);

      expect(stockQueue.add).toHaveBeenCalledWith('notify', {
        variantId: VARIANT_ID,
      });
    });

    it('should NOT enqueue a low-stock notification when post-decrement stock is above the threshold', async () => {
      // stockQuantity=10, quantity=2 → post-decrement = 8 → no notification
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      prisma.order.create.mockResolvedValue(mockOrder);
      prisma.payment.create.mockResolvedValue(mockPayment);
      prisma.productVariant.update.mockResolvedValue({
        ...mockVariant,
        stockQuantity: 8,
      });

      await service.handleCheckoutSessionCompleted(mockSession);

      expect(stockQueue.add).not.toHaveBeenCalled();
    });
  });
});
