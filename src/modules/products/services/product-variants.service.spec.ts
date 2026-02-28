import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Product, ProductOptionValue, ProductVariant } from '@prisma/client';
import Stripe from 'stripe';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import { ProductVariantsService } from './product-variants.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const PRODUCT_ID = 'product-uuid-1';
const VARIANT_ID = 'variant-uuid-1';
const OPTION_ID = 'option-uuid-1';
const OPTION_VALUE_ID = 'option-value-uuid-1';
const NEW_OPTION_VALUE_ID = 'option-value-uuid-2';

const STRIPE_PRODUCT_ID = 'prod_stripe123';
const STRIPE_PRICE_ID = 'price_stripe123';
const STRIPE_NEW_PRICE_ID = 'price_new123';
const STRIPE_PAYMENT_LINK_ID = 'plink_stripe123';
const STRIPE_NEW_PAYMENT_LINK_ID = 'plink_new123';
const PAYMENT_LINK_URL = 'https://buy.stripe.com/test';
const NEW_PAYMENT_LINK_URL = 'https://buy.stripe.com/new';

// Variant as returned by the DB transaction (before Stripe sync)
const mockCreatedVariant: ProductVariant = {
  id: VARIANT_ID,
  productId: PRODUCT_ID,
  sku: 'SKU-001',
  price: 1000,
  stockQuantity: 10,
  isActive: true,
  image: null,
  stripeProductId: null,
  stripePriceId: null,
  stripePaymentLinkId: null,
  paymentLinkUrl: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

// Fully synced variant (Stripe IDs populated)
const mockVariant: ProductVariant = {
  ...mockCreatedVariant,
  stripeProductId: STRIPE_PRODUCT_ID,
  stripePriceId: STRIPE_PRICE_ID,
  stripePaymentLinkId: STRIPE_PAYMENT_LINK_ID,
  paymentLinkUrl: PAYMENT_LINK_URL,
};

const mockProductWithOptions = {
  id: PRODUCT_ID,
  name: 'Test Product',
  description: 'A test product',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  productOptions: [
    {
      id: OPTION_ID,
      productId: PRODUCT_ID,
      name: 'Color',
      values: [{ id: OPTION_VALUE_ID, value: 'Red', optionId: OPTION_ID }],
    },
  ],
};

// ─── ProductVariantsService ───────────────────────────────────────────────────

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;
  let prisma: DeepMockProxy<PrismaService>;
  let stripe: DeepMocked<StripeService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    stripe = createMock<StripeService>();
    configService = createMock<ConfigService>();
    service = new ProductVariantsService(prisma, stripe, configService);
  });

  // ─── addVariant ───────────────────────────────────────────────────────────

  describe('addVariant', () => {
    // Input that matches exactly the one Color option with its "Red" value
    const validInput = {
      sku: 'SKU-001',
      price: 1000,
      stockQuantity: 10,
      selectedOptions: [{ name: 'Color', value: 'Red' }],
    };

    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValue(
        mockProductWithOptions as Product,
      );

      // Execute the transaction callback immediately using the same mock as the tx client
      (prisma.$transaction as jest.Mock).mockImplementation(
        (fn: (tx: DeepMockProxy<PrismaService>) => Promise<ProductVariant>) =>
          fn(prisma),
      );

      prisma.productVariant.findMany.mockResolvedValue([]); // no duplicates by default
      prisma.productVariant.create.mockResolvedValue(mockCreatedVariant);
      prisma.productVariant.update.mockResolvedValue(mockVariant);
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);

      stripe.createProduct.mockResolvedValue({
        id: STRIPE_PRODUCT_ID,
      } as Stripe.Response<Stripe.Product>);
      stripe.createPrice.mockResolvedValue({
        id: STRIPE_PRICE_ID,
      } as Stripe.Response<Stripe.Price>);
      stripe.createPaymentLink.mockResolvedValue({
        id: STRIPE_PAYMENT_LINK_ID,
        url: PAYMENT_LINK_URL,
      } as Stripe.Response<Stripe.PaymentLink>);

      (configService.getOrThrow as jest.Mock)
        .mockReturnValueOnce('test-bucket')
        .mockReturnValueOnce('us-east-1');
    });

    it('throws NotFoundException when the product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.addVariant(PRODUCT_ID, validInput)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the product has no options defined', async () => {
      prisma.product.findFirst.mockResolvedValue({
        ...mockProductWithOptions,
        productOptions: [],
      } as Product);

      await expect(service.addVariant(PRODUCT_ID, validInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when input does not cover all product options', async () => {
      // Product expects Color + Size, but input only supplies Color (size mismatch)
      prisma.product.findFirst.mockResolvedValue({
        ...mockProductWithOptions,
        productOptions: [
          {
            id: OPTION_ID,
            productId: PRODUCT_ID,
            name: 'Color',
            values: [
              { id: OPTION_VALUE_ID, value: 'Red', optionId: OPTION_ID },
            ],
          },
          {
            id: 'option-uuid-2',
            productId: PRODUCT_ID,
            name: 'Size',
            values: [
              { id: 'val-uuid-2', value: 'M', optionId: 'option-uuid-2' },
            ],
          },
        ],
      } as Product);

      await expect(
        service.addVariant(PRODUCT_ID, validInput), // only 1 option provided
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when input has the right count but includes an unrecognized option name', async () => {
      // Product has Color + Size, input provides Color + Pattern (same count, different name).
      // This exercises the name-matching loop, not the size check.
      prisma.product.findFirst.mockResolvedValue({
        ...mockProductWithOptions,
        productOptions: [
          {
            id: OPTION_ID,
            productId: PRODUCT_ID,
            name: 'Color',
            values: [
              { id: OPTION_VALUE_ID, value: 'Red', optionId: OPTION_ID },
            ],
          },
          {
            id: 'option-uuid-2',
            productId: PRODUCT_ID,
            name: 'Size',
            values: [
              { id: 'val-uuid-2', value: 'M', optionId: 'option-uuid-2' },
            ],
          },
        ],
      } as Product);

      await expect(
        service.addVariant(PRODUCT_ID, {
          ...validInput,
          selectedOptions: [
            { name: 'Color', value: 'Red' },
            { name: 'Pattern', value: 'Striped' }, // 'Pattern' is not a product option
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when a variant with the same option combination already exists', async () => {
      // Existing variant holds the same option value ID that the new input resolves to.
      prisma.productVariant.findMany.mockResolvedValue([
        {
          optionValues: [{ productOptionValue: { id: OPTION_VALUE_ID } }],
        },
      ] as unknown as ProductVariant[]);

      await expect(service.addVariant(PRODUCT_ID, validInput)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a new ProductOptionValue dynamically when the selected value is not yet defined', async () => {
      // "Blue" is not in the existing values list (only "Red" is), so it must be created
      const mockNewOptionValue: ProductOptionValue = {
        id: NEW_OPTION_VALUE_ID,
        value: 'Blue',
        optionId: OPTION_ID,
        createdAt: new Date('2024-01-01'),
      };
      prisma.productOptionValue.create.mockResolvedValue(mockNewOptionValue);

      await service.addVariant(PRODUCT_ID, {
        ...validInput,
        selectedOptions: [{ name: 'Color', value: 'Blue' }],
      });

      expect(prisma.productOptionValue.create).toHaveBeenCalledWith({
        data: { optionId: OPTION_ID, value: 'Blue' },
      });
    });

    it('calls createProduct → createPrice → createPaymentLink in order and persists the Stripe IDs', async () => {
      await service.addVariant(PRODUCT_ID, validInput);

      expect(stripe.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Product - Red', // product.name + ' - ' + selectedOptions values
        }),
      );
      expect(stripe.createPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeProductId: STRIPE_PRODUCT_ID,
          unitAmount: mockCreatedVariant.price,
          metadata: { variantId: VARIANT_ID },
        }),
      );
      expect(stripe.createPaymentLink).toHaveBeenCalledWith({
        stripePriceId: STRIPE_PRICE_ID,
        variantId: VARIANT_ID,
      });
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
        data: {
          stripeProductId: STRIPE_PRODUCT_ID,
          stripePriceId: STRIPE_PRICE_ID,
          stripePaymentLinkId: STRIPE_PAYMENT_LINK_ID,
          paymentLinkUrl: PAYMENT_LINK_URL,
        },
      });
    });

    it('reconstructs a full S3 URL for Stripe when the image field is a storage key', async () => {
      const s3Key = 'products/variants/image.jpg';
      prisma.productVariant.create.mockResolvedValue({
        ...mockCreatedVariant,
        image: s3Key,
      });

      await service.addVariant(PRODUCT_ID, { ...validInput, image: s3Key });

      expect(stripe.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [`https://test-bucket.s3.us-east-1.amazonaws.com/${s3Key}`],
        }),
      );
    });

    it('passes an http image URL directly to Stripe without reconstruction', async () => {
      const httpImage = 'https://cdn.example.com/image.jpg';
      prisma.productVariant.create.mockResolvedValue({
        ...mockCreatedVariant,
        image: httpImage,
      });

      await service.addVariant(PRODUCT_ID, { ...validInput, image: httpImage });

      expect(stripe.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ images: [httpImage] }),
      );
    });

    it('still returns the created variant when Stripe sync throws', async () => {
      stripe.createProduct.mockRejectedValue(new Error('Stripe unavailable'));

      // Stripe IDs were never written — findUnique reflects the un-synced state
      prisma.productVariant.findUnique.mockResolvedValue(mockCreatedVariant);

      const actual = await service.addVariant(PRODUCT_ID, validInput);

      expect(actual).toEqual(mockCreatedVariant);
      expect(prisma.productVariant.findUnique).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
      });
    });
  });

  // ─── updateVariant ────────────────────────────────────────────────────────

  describe('updateVariant', () => {
    beforeEach(() => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant);
      prisma.productVariant.update.mockResolvedValue(mockVariant);
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);

      stripe.updateProduct.mockResolvedValue(
        {} as Stripe.Response<Stripe.Product>,
      );
      stripe.createPrice.mockResolvedValue({
        id: STRIPE_NEW_PRICE_ID,
      } as Stripe.Response<Stripe.Price>);
      stripe.createPaymentLink.mockResolvedValue({
        id: STRIPE_NEW_PAYMENT_LINK_ID,
        url: NEW_PAYMENT_LINK_URL,
      } as Stripe.Response<Stripe.PaymentLink>);
    });

    it('throws NotFoundException when the variant does not exist', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(
        service.updateVariant(VARIANT_ID, { sku: 'NEW-SKU' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('skips all Stripe calls when the variant has no linked Stripe product', async () => {
      prisma.productVariant.findFirst.mockResolvedValue({
        ...mockVariant,
        stripeProductId: null,
      });

      await service.updateVariant(VARIANT_ID, { price: 2000 });

      expect(stripe.updateProduct).not.toHaveBeenCalled();
      expect(stripe.deactivatePrice).not.toHaveBeenCalled();
      expect(stripe.createPrice).not.toHaveBeenCalled();
      expect(stripe.createPaymentLink).not.toHaveBeenCalled();
    });

    it('updates the Stripe product images when the variant image changes', async () => {
      const newImage = 'products/variants/new-image.jpg';
      prisma.productVariant.update.mockResolvedValue({
        ...mockVariant,
        image: newImage,
      });

      (configService.getOrThrow as jest.Mock)
        .mockReturnValueOnce('test-bucket')
        .mockReturnValueOnce('us-east-1');

      await service.updateVariant(VARIANT_ID, { image: newImage });

      expect(stripe.updateProduct).toHaveBeenCalledWith(STRIPE_PRODUCT_ID, {
        images: [`https://test-bucket.s3.us-east-1.amazonaws.com/${newImage}`],
      });
    });

    it('deactivates the old price and payment link then creates new ones when price changes', async () => {
      prisma.productVariant.update.mockResolvedValue({
        ...mockVariant,
        price: 2000,
      });

      await service.updateVariant(VARIANT_ID, { price: 2000 });

      // Old resources deactivated first
      expect(stripe.deactivatePrice).toHaveBeenCalledWith(STRIPE_PRICE_ID);
      expect(stripe.deactivatePaymentLink).toHaveBeenCalledWith(
        STRIPE_PAYMENT_LINK_ID,
      );
      // New resources created
      expect(stripe.createPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeProductId: STRIPE_PRODUCT_ID,
          unitAmount: 2000,
          metadata: { variantId: VARIANT_ID },
        }),
      );
      expect(stripe.createPaymentLink).toHaveBeenCalledWith({
        stripePriceId: STRIPE_NEW_PRICE_ID,
        variantId: VARIANT_ID,
      });
      // DB updated with new Stripe IDs
      expect(prisma.productVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePriceId: STRIPE_NEW_PRICE_ID,
            stripePaymentLinkId: STRIPE_NEW_PAYMENT_LINK_ID,
            paymentLinkUrl: NEW_PAYMENT_LINK_URL,
          }),
        }),
      );
    });

    it('updates the Stripe product image and rotates price resources when both change simultaneously', async () => {
      const newImage = 'products/variants/updated.jpg';
      const newPrice = 2000;
      prisma.productVariant.update.mockResolvedValue({
        ...mockVariant,
        image: newImage,
        price: newPrice,
      });
      (configService.getOrThrow as jest.Mock)
        .mockReturnValueOnce('test-bucket')
        .mockReturnValueOnce('us-east-1');

      await service.updateVariant(VARIANT_ID, {
        image: newImage,
        price: newPrice,
      });

      expect(stripe.updateProduct).toHaveBeenCalledWith(
        STRIPE_PRODUCT_ID,
        expect.objectContaining({
          images: [
            `https://test-bucket.s3.us-east-1.amazonaws.com/${newImage}`,
          ],
        }),
      );
      expect(stripe.deactivatePrice).toHaveBeenCalledWith(STRIPE_PRICE_ID);
      expect(stripe.createPrice).toHaveBeenCalledWith(
        expect.objectContaining({ unitAmount: newPrice }),
      );
      expect(stripe.createPaymentLink).toHaveBeenCalled();
    });
  });

  // ─── deleteVariant ────────────────────────────────────────────────────────

  describe('deleteVariant', () => {
    const deletedAt = new Date('2024-06-01');
    const mockDeletedVariant: ProductVariant = { ...mockVariant, deletedAt };

    beforeEach(() => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant);
      prisma.productVariant.count.mockResolvedValue(3); // multiple active → deletion allowed
      prisma.productVariant.update.mockResolvedValue(mockDeletedVariant);

      stripe.deactivateProduct.mockResolvedValue(
        {} as Stripe.Response<Stripe.Product>,
      );
      stripe.deactivatePrice.mockResolvedValue(
        {} as Stripe.Response<Stripe.Price>,
      );
      stripe.deactivatePaymentLink.mockResolvedValue(
        {} as Stripe.Response<Stripe.PaymentLink>,
      );
    });

    it('throws NotFoundException when the variant does not exist', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(service.deleteVariant(VARIANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when deleting the last active variant of a product', async () => {
      prisma.productVariant.count.mockResolvedValue(1);

      await expect(service.deleteVariant(VARIANT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deactivates the Stripe product, price, and payment link before soft-deleting', async () => {
      await service.deleteVariant(VARIANT_ID);

      expect(stripe.deactivateProduct).toHaveBeenCalledWith(STRIPE_PRODUCT_ID);
      expect(stripe.deactivatePrice).toHaveBeenCalledWith(STRIPE_PRICE_ID);
      expect(stripe.deactivatePaymentLink).toHaveBeenCalledWith(
        STRIPE_PAYMENT_LINK_ID,
      );
    });

    it('soft-deletes the variant by stamping deletedAt', async () => {
      await service.deleteVariant(VARIANT_ID);

      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('still attempts all remaining Stripe deactivations and completes the soft-delete when one call throws', async () => {
      // Each deactivation runs in its own try-catch — a failure in one must not
      // prevent the remaining calls or the final soft-delete from executing.
      stripe.deactivateProduct.mockRejectedValue(
        new Error('Stripe unavailable'),
      );

      const result = await service.deleteVariant(VARIANT_ID);

      // Remaining deactivations must still be attempted despite the first failure
      expect(stripe.deactivatePrice).toHaveBeenCalledWith(STRIPE_PRICE_ID);
      expect(stripe.deactivatePaymentLink).toHaveBeenCalledWith(
        STRIPE_PAYMENT_LINK_ID,
      );
      // Soft-delete proceeds regardless
      expect(result.deletedAt).toEqual(deletedAt);
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('skips all Stripe deactivation calls when the variant has no Stripe resources linked', async () => {
      prisma.productVariant.findFirst.mockResolvedValue({
        ...mockVariant,
        stripeProductId: null,
        stripePriceId: null,
        stripePaymentLinkId: null,
      });

      await service.deleteVariant(VARIANT_ID);

      expect(stripe.deactivateProduct).not.toHaveBeenCalled();
      expect(stripe.deactivatePrice).not.toHaveBeenCalled();
      expect(stripe.deactivatePaymentLink).not.toHaveBeenCalled();
    });
  });
});
