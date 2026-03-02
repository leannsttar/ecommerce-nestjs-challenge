import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ProductOption, ProductOptionValue } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateVariantInput } from '../dto/variants/create-variant.input';
import { UpdateVariantInput } from '../dto/variants/update-variant.input';
import { StripeService } from '../../stripe/stripe.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly configService: ConfigService,
  ) {}

  async addVariant(productId: string, input: CreateVariantInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: { productOptions: { include: { values: true } } },
    });

    if (!product)
      throw new NotFoundException(`Product with ID ${productId} not found`);

    if (!product.productOptions || product.productOptions.length === 0) {
      throw new BadRequestException(
        'Product has no options defined. Cannot add variants.',
      );
    }

    // Validate that input covers all options
    const optionNames = new Set(product.productOptions.map((o) => o.name));
    const inputOptionNames = new Set(input.selectedOptions.map((s) => s.name));

    if (optionNames.size !== inputOptionNames.size) {
      throw new BadRequestException(
        `Variant must specify all product options. Expected: ${Array.from(optionNames).join(', ')}. ` +
          `Received: ${Array.from(inputOptionNames).join(', ')}`,
      );
    }

    for (const optionName of optionNames) {
      if (!inputOptionNames.has(optionName)) {
        throw new BadRequestException(
          `Missing value for option: ${optionName}`,
        );
      }
    }

    const optionMap = new Map<
      string,
      ProductOption & { values: ProductOptionValue[] }
    >();
    const valueMap = new Map<string, string>();

    for (const option of product.productOptions) {
      optionMap.set(option.name, option);
      for (const val of option.values) {
        valueMap.set(`${option.name}:${val.value}`, val.id);
      }
    }

    const variantResult = await this.prisma.$transaction(async (tx) => {
      const optionValueIds: string[] = [];
      for (const selected of input.selectedOptions) {
        const valueKey = `${selected.name}:${selected.value}`;
        let valueId = valueMap.get(valueKey);

        // If value doesn't exist, create it dynamically
        if (!valueId) {
          const option = optionMap.get(selected.name);
          if (!option) {
            throw new BadRequestException(
              `Option "${selected.name}" does not exist for this product. ` +
                `Available options: ${Array.from(optionMap.keys()).join(', ')}`,
            );
          }

          // Create new ProductOptionValue
          const newValue = await tx.productOptionValue.create({
            data: {
              optionId: option.id,
              value: selected.value,
            },
          });

          valueId = newValue.id;
          //  prevent duplicates in same transaction
          valueMap.set(valueKey, valueId);
        }

        optionValueIds.push(valueId);
      }

      // Check for duplicate option combination
      const existingVariants = await tx.productVariant.findMany({
        where: { productId, deletedAt: null },
        include: {
          optionValues: {
            include: { productOptionValue: true },
          },
        },
      });

      for (const variant of existingVariants) {
        const variantValueIds = variant.optionValues
          .map((ov) => ov.productOptionValue.id)
          .sort();
        const newValueIds = [...optionValueIds].sort();

        if (JSON.stringify(variantValueIds) === JSON.stringify(newValueIds)) {
          const combination = input.selectedOptions
            .map((s) => s.value)
            .join(' / ');
          throw new ConflictException(
            `A variant with the combination "${combination}" already exists`,
          );
        }
      }

      const variant = await tx.productVariant.create({
        data: {
          productId,
          sku: input.sku,
          price: input.price,
          stockQuantity: input.stockQuantity,
          image: input.image,
          optionValues: {
            create: optionValueIds.map((valueId) => ({
              productOptionValue: { connect: { id: valueId } },
            })),
          },
        },
      });

      return variant;
    });

    // After DB creation, sync with Stripe.
    // We do this OUTSIDE the DB transaction because Stripe calls are external
    // and cannot be rolled back. If Stripe fails, the variant exists in our DB
    // without Stripe IDs, which is recoverable (can retry Stripe sync separately).

    /**
     * 📖 STRIPE SYNC: 1 Variant = 1 Stripe Product
     * We create a Stripe Product specific to this variant so it can have
     * its own unique image and SKU at checkout.
     */
    try {
      const bucket = this.configService.getOrThrow('s3.bucket');
      const region = this.configService.getOrThrow('s3.region');

      let imageUrls: string[] | undefined;
      // Reconstruct full S3 URL for Stripe if an image key exists
      if (variantResult.image) {
        if (variantResult.image.startsWith('http')) {
          imageUrls = [variantResult.image];
        } else {
          imageUrls = [
            `https://${bucket}.s3.${region}.amazonaws.com/${variantResult.image}`,
          ];
        }
      }

      const variantName = `${product.name} - ${input.selectedOptions
        .map((o) => o.value)
        .join(' / ')}`;

      // Step 1: Create Variant Stripe Product
      const stripeProduct = await this.stripe.createProduct({
        name: variantName,
        images: imageUrls,
      });

      // Step 2: Create Price
      const stripePrice = await this.stripe.createPrice({
        stripeProductId: stripeProduct.id,
        unitAmount: variantResult.price,
        metadata: { variantId: variantResult.id },
      });

      // Step 3: Create Payment Link
      const stripePaymentLink = await this.stripe.createPaymentLink({
        stripePriceId: stripePrice.id,
        variantId: variantResult.id,
      });

      // Step 4: Update the variant record with Stripe IDs
      await this.prisma.productVariant.update({
        where: { id: variantResult.id },
        data: {
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id,
          stripePaymentLinkId: stripePaymentLink.id,
          paymentLinkUrl: stripePaymentLink.url,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to sync variant ${variantResult.id} with Stripe: ${err.message}`,
      );
    }

    return this.prisma.productVariant.findUnique({
      where: { id: variantResult.id },
    });
  }

  /**
   * Update a variant. If the price changes, we must deactivate the old
   * Stripe Price and Payment Link and create new ones.
   *
   * 📖 WHY THE OLD PRICE MUST BE DEACTIVATED:
   * Stripe Prices are immutable. You cannot change '$20' to '$25' on the same
   * Price object. Instead you create a new Price and archive the old one.
   * The Payment Link also needs to be recreated because it references a specific Price.
   */
  async updateVariant(variantId: string, input: UpdateVariantInput) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        sku: input.sku,
        price: input.price,
        stockQuantity: input.stockQuantity,
        image: input.image,
      },
    });

    // Stripe sync:
    // 1. If sku or image changed, update Stripe Product
    // 2. If price changed, rotate Price and Payment Link

    if (existing.stripeProductId) {
      try {
        const imageChanged =
          input.image !== undefined && input.image !== existing.image;

        if (imageChanged) {
          let imageUrls: string[] | undefined;

          if (updated.image) {
            const bucket = this.configService.getOrThrow('s3.bucket');
            const region = this.configService.getOrThrow('s3.region');

            if (updated.image.startsWith('http')) {
              imageUrls = [updated.image];
            } else {
              imageUrls = [
                `https://${bucket}.s3.${region}.amazonaws.com/${updated.image}`,
              ];
            }
          }

          await this.stripe.updateProduct(existing.stripeProductId, {
            images: imageUrls || [],
          });
        }

        const priceChanged =
          input.price !== undefined && input.price !== existing.price;

        if (priceChanged) {
          // Step 1: Deactivate old Price and Payment Link
          if (existing.stripePriceId) {
            await this.stripe.deactivatePrice(existing.stripePriceId);
          }
          if (existing.stripePaymentLinkId) {
            await this.stripe.deactivatePaymentLink(
              existing.stripePaymentLinkId,
            );
          }

          // Step 2: Create new Price
          const newPrice = await this.stripe.createPrice({
            stripeProductId: existing.stripeProductId,
            unitAmount: updated.price,
            metadata: { variantId },
          });

          // Step 3: Create new Payment Link
          const newPaymentLink = await this.stripe.createPaymentLink({
            stripePriceId: newPrice.id,
            variantId,
          });

          // Step 4: Update DB with new Stripe IDs
          await this.prisma.productVariant.update({
            where: { id: variantId },
            data: {
              stripePriceId: newPrice.id,
              stripePaymentLinkId: newPaymentLink.id,
              paymentLinkUrl: newPaymentLink.url,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `Failed to sync variant update ${variantId} with Stripe: ${err.message}`,
        );
      }
    }

    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
  }

  /**
   * Soft-delete a variant. Deactivates Stripe Price and Payment Link.
   *
   * 📖 After deactivation the Payment Link URL no longer works, preventing
   * customers from purchasing a deleted variant via the shareable link.
   */
  async deleteVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with ID ${variantId} not found`);
    }

    const activeVariantsCount = await this.prisma.productVariant.count({
      where: {
        productId: variant.productId,
        deletedAt: null,
      },
    });

    if (activeVariantsCount === 1) {
      throw new ConflictException(
        'Cannot delete the last active variant. A product must have at least one variant available for sale.',
      );
    }

    // Deactivate Stripe Product, Price and Payment Link before soft-deleting
    if (variant.stripeProductId) {
      try {
        await this.stripe.deactivateProduct(variant.stripeProductId);
      } catch (err) {
        this.logger.warn(
          `Failed to deactivate Stripe product ${variant.stripeProductId}: ${err.message}`,
        );
      }
    }
    if (variant.stripePriceId) {
      try {
        await this.stripe.deactivatePrice(variant.stripePriceId);
      } catch (err) {
        this.logger.warn(
          `Failed to deactivate Stripe price ${variant.stripePriceId}: ${err.message}`,
        );
      }
    }
    if (variant.stripePaymentLinkId) {
      try {
        await this.stripe.deactivatePaymentLink(variant.stripePaymentLinkId);
      } catch (err) {
        this.logger.warn(
          `Failed to deactivate Stripe payment link ${variant.stripePaymentLinkId}: ${err.message}`,
        );
      }
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date() },
    });
  }
}
