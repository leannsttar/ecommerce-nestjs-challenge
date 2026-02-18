import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVariantInput } from '../dto/create-variant.input';
import { UpdateVariantInput } from '../dto/update-variant.input';

@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async addVariant(productId: string, input: CreateVariantInput) {
    // Validate product exists and get its options
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

    // Build Maps for O(1) lookups
    const optionMap = new Map<string, any>();
    const valueMap = new Map<string, string>();

    for (const option of product.productOptions) {
      optionMap.set(option.name, option);
      for (const val of option.values) {
        valueMap.set(`${option.name}:${val.value}`, val.id);
      }
    }

    // Create variant using transaction
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Map selectedOptions to option value IDs (create if they don't exist)
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
            // Update the map to prevent duplicates in same transaction
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
            throw new BadRequestException(
              `A variant with the combination "${combination}" already exists`,
            );
          }
        }

        // Create the variant
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
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('SKU already exists');
      }
      throw error;
    }
  }

  async updateVariant(variantId: string, input: UpdateVariantInput) {
    try {
      const updatedVariant = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          sku: input.sku,
          price: input.price,
          stockQuantity: input.stockQuantity,
          image: input.image,
        },
      });
      return updatedVariant;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('SKU already exists');
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Variant with ID ${variantId} not found`);
      }
      throw error;
    }
  }

  async deleteVariant(variantId: string) {
    // Check variant exists
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with ID ${variantId} not found`);
    }

    // Check if this is the last active variant for the product
    const activeVariantsCount = await this.prisma.productVariant.count({
      where: {
        productId: variant.productId,
        deletedAt: null,
      },
    });

    if (activeVariantsCount === 1) {
      throw new BadRequestException(
        'Cannot delete the last active variant. A product must have at least one variant available for sale.',
      );
    }

    // Soft delete
    try {
      const deletedVariant = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { deletedAt: new Date() },
      });
      return deletedVariant;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Variant with ID ${variantId} not found`);
      }
      throw error;
    }
  }
}
