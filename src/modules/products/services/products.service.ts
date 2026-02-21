import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductInput } from '../dto/create-product.input';
import { UpdateProductInput } from '../dto/update-product.input';
import { AddImageInput } from '../dto/add-image.input';
import { StripeService } from '../../stripe/stripe.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async findAll(
    limit: number,
    offset: number,
    categoryId?: string,
    includeInactive: boolean = false,
  ) {
    const pageNumber = Math.max(1, Math.floor(offset / limit) + 1);
    const where = {
      deletedAt: null,
      isActive: includeInactive ? undefined : true,
      ...(categoryId && {
        categories: {
          some: { categoryId },
        },
      }),
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      page: pageNumber,
      limit,
      totalItems,
      totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPreviousPage: pageNumber > 1,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(input: CreateProductInput) {
    const { images, featuredImage, categoryIds, options, ...productData } =
      input;

    // remove featuredImage from images array if exists
    let galleryImages = images || [];
    if (featuredImage && galleryImages.includes(featuredImage)) {
      galleryImages = galleryImages.filter((key) => key !== featuredImage);
    }

    // Build array of images to save
    const imagesToCreate: Array<{ url: string; isMain: boolean }> = [];

    if (featuredImage) {
      imagesToCreate.push({ url: featuredImage, isMain: true });
    }

    if (galleryImages.length > 0) {
      imagesToCreate.push(
        ...galleryImages.map((imageUrl) => ({ url: imageUrl, isMain: false })),
      );
    }

    /**
     * 📖 STRIPE SYNC: Create Stripe Product first
     * We create the Stripe Product BEFORE saving to the DB.
     * If Stripe fails, we don't create the DB record either (no orphans).
     * If the DB insert fails after Stripe creation, we have an orphan Stripe
     * Product, which is acceptable — it stays inactive and won't affect billing.
     */
    let stripeProductId: string | undefined;
    try {
      const stripeProduct = await this.stripe.createProduct({
        name: productData.name,
        description: productData.description,
      });
      stripeProductId = stripeProduct.id;
    } catch (err) {
      this.logger.error(`Failed to create Stripe product: ${err.message}`);
      throw new InternalServerErrorException(
        'Could not create product in Stripe',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          stripeProductId,
          categories: {
            create: categoryIds.map((id) => ({
              category: { connect: { id } },
            })),
          },
          images:
            imagesToCreate.length > 0 ? { create: imagesToCreate } : undefined,
        },
      });

      await Promise.all(
        options.map((option) =>
          tx.productOption.create({
            data: {
              productId: product.id,
              name: option.name,
              values: {
                create: option.values.map((value) => ({ value })),
              },
            },
          }),
        ),
      );

      return product;
    });
  }

  async update(id: string, input: UpdateProductInput) {
    const { categoryIds, ...updateData } = input;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        // Update categories if provided
        categories: categoryIds
          ? {
              deleteMany: {}, // Remove all
              create: categoryIds.map((catId) => ({
                category: { connect: { id: catId } },
              })),
            }
          : undefined,
      },
    });
  }

  /**
   * Soft delete the product. Also deactivates it on Stripe.
   *
   * 📖 WHY DEACTIVATE ON STRIPE?
   * If we just delete it in our DB but leave it active in Stripe, the
   * payment links for its variants would still work! Customers could still
   * check out for a product that no longer exists in our system.
   */
  async remove(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    if (product.stripeProductId) {
      try {
        await this.stripe.deactivateProduct(product.stripeProductId);
      } catch (err) {
        this.logger.warn(
          `Failed to deactivate Stripe product ${product.stripeProductId}: ${err.message}`,
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Disable the product (sets isActive=false). Also deactivates on Stripe.
   */
  async disable(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    if (product.stripeProductId) {
      try {
        await this.stripe.deactivateProduct(product.stripeProductId);
      } catch (err) {
        this.logger.warn(
          `Failed to deactivate Stripe product ${product.stripeProductId}: ${err.message}`,
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async enable(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async addProductImage(productId: string, input: AddImageInput) {
    return this.prisma.productImage.create({
      data: {
        productId,
        url: input.imageUrl,
        isMain: false,
      },
    });
  }

  async deleteProductImage(id: string) {
    return this.prisma.productImage.delete({
      where: { id },
    });
  }
}
