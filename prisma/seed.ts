import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Seeding database...');

  // Clean existing data used in seeed (optional but recommended for consistency)
  // Deleting in reverse order of dependency
  await prisma.productVariantValue.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productOptionValue.deleteMany();
  await prisma.productOption.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  console.log('Deleted existing data.');

  // === Categories ===
  const electronics = await prisma.category.create({
    data: { name: 'Electronics' },
  });
  const clothing = await prisma.category.create({
    data: { name: 'Clothing' },
  });
  const books = await prisma.category.create({
    data: { name: 'Books' },
  });

  console.log('Created Categories:', [
    electronics.name,
    clothing.name,
    books.name,
  ]);

  // === Products ===

  // 1. Smartphone (Electronics) - 1 Variant
  const smartphone = await prisma.product.create({
    data: {
      name: 'Smartphone X',
      description: 'Latest model smartphone with advanced features.',
      categories: { create: { categoryId: electronics.id } },
    },
  });

  const smartphoneColor = await prisma.productOption.create({
    data: {
      productId: smartphone.id,
      name: 'Color',
      values: { create: [{ value: 'Black' }] },
    },
    include: { values: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: smartphone.id,
      sku: 'PHONE-X-BLK',
      price: 999,
      stockQuantity: 50,
      optionValues: {
        create: { productOptionValueId: smartphoneColor.values[0].id },
      },
    },
  });

  // 2. T-Shirt (Clothing) - 1 Variant
  const tshirt = await prisma.product.create({
    data: {
      name: 'Classic T-Shirt',
      description: 'Comfortable cotton t-shirt.',
      categories: { create: { categoryId: clothing.id } },
    },
  });

  const tshirtSize = await prisma.productOption.create({
    data: {
      productId: tshirt.id,
      name: 'Size',
      values: { create: [{ value: 'M' }] },
    },
    include: { values: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: tshirt.id,
      sku: 'TSHIRT-M',
      price: 25,
      stockQuantity: 100,
      optionValues: {
        create: { productOptionValueId: tshirtSize.values[0].id },
      },
    },
  });

  // 3. Novel (Books) - 1 Variant
  const novel = await prisma.product.create({
    data: {
      name: 'The Great Adventure',
      description: 'A thrilling novel about exploration.',
      categories: { create: { categoryId: books.id } },
    },
  });

  const novelFormat = await prisma.productOption.create({
    data: {
      productId: novel.id,
      name: 'Format',
      values: { create: [{ value: 'Hardcover' }] },
    },
    include: { values: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: novel.id,
      sku: 'BOOK-ADV-HC',
      price: 30,
      stockQuantity: 40,
      optionValues: {
        create: { productOptionValueId: novelFormat.values[0].id },
      },
    },
  });

  // 4. Headphones (Electronics) - 1 Variant
  const headphones = await prisma.product.create({
    data: {
      name: 'Noise Cancelling Headphones',
      description: 'Experience silence with these headphones.',
      categories: { create: { categoryId: electronics.id } },
    },
  });

  const headphonesColor = await prisma.productOption.create({
    data: {
      productId: headphones.id,
      name: 'Color',
      values: { create: [{ value: 'White' }] },
    },
    include: { values: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: headphones.id,
      sku: 'HEAD-NC-WHT',
      price: 150,
      stockQuantity: 30,
      optionValues: {
        create: { productOptionValueId: headphonesColor.values[0].id },
      },
    },
  });

  // 5. Laptop (Electronics) - 2 Variants
  const laptop = await prisma.product.create({
    data: {
      name: 'Pro Laptop 15',
      description: 'High performance laptop for professionals.',
      categories: { create: { categoryId: electronics.id } },
    },
  });

  const laptopRam = await prisma.productOption.create({
    data: {
      productId: laptop.id,
      name: 'RAM',
      values: { create: [{ value: '8GB' }, { value: '16GB' }] },
    },
    include: { values: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: laptop.id,
      sku: 'LAPTOP-15-8GB',
      price: 1200,
      stockQuantity: 20,
      optionValues: {
        create: {
          productOptionValueId: laptopRam.values.find((v) => v.value === '8GB')!
            .id,
        },
      },
    },
  });

  await prisma.productVariant.create({
    data: {
      productId: laptop.id,
      sku: 'LAPTOP-15-16GB',
      price: 1500,
      stockQuantity: 15,
      optionValues: {
        create: {
          productOptionValueId: laptopRam.values.find(
            (v) => v.value === '16GB',
          )!.id,
        },
      },
    },
  });

  // 6. Sneakers (Clothing) - 2 Variants
  const sneakers = await prisma.product.create({
    data: {
      name: 'Urban Sneakers',
      description: 'Stylish sneakers for everyday wear.',
      categories: { create: { categoryId: clothing.id } },
    },
  });

  const sneakersSize = await prisma.productOption.create({
    data: {
      productId: sneakers.id,
      name: 'Size',
      values: { create: [{ value: '42' }, { value: '43' }] },
    },
    include: { values: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: sneakers.id,
      sku: 'SNEAKER-URB-42',
      price: 80,
      stockQuantity: 60,
      optionValues: {
        create: {
          productOptionValueId: sneakersSize.values.find(
            (v) => v.value === '42',
          )!.id,
        },
      },
    },
  });

  await prisma.productVariant.create({
    data: {
      productId: sneakers.id,
      sku: 'SNEAKER-URB-43',
      price: 80,
      stockQuantity: 55,
      optionValues: {
        create: {
          productOptionValueId: sneakersSize.values.find(
            (v) => v.value === '43',
          )!.id,
        },
      },
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
