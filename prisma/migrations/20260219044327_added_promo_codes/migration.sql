-- CreateEnum
CREATE TYPE "promo_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "promo_type" NOT NULL,
    "value" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "usage_limit" INTEGER NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "min_purchase" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
