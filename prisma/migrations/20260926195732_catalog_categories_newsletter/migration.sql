-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SMARTPHONE', 'LAPTOP', 'WATCH', 'EARBUDS', 'HEADPHONES', 'ACCESSORY');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT NOT NULL DEFAULT 'Apple',
ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'ACCESSORY',
ADD COLUMN     "compareAtPriceCents" INTEGER,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "Product_active_category_idx" ON "Product"("active", "category");

-- Le prix barré doit être supérieur au prix de vente (sinon ce n'est pas une réduction).
ALTER TABLE "Product" ADD CONSTRAINT "Product_compare_at_above_price"
  CHECK ("compareAtPriceCents" IS NULL OR "compareAtPriceCents" > "priceCents");
