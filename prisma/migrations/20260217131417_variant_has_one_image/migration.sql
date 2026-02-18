-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "image" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
