/*
  Warnings:

  - You are about to drop the column `stripe_product_id` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "stripe_product_id" TEXT;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "stripe_product_id";
