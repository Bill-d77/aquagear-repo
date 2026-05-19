-- CreateTable: ProductImage (multi-image support for products)
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_order_idx" ON "ProductImage"("productId", "order");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: make imageUrl optional (default empty string for existing rows)
ALTER TABLE "Product" ALTER COLUMN "imageUrl" SET DEFAULT '';

-- Data migration: seed ProductImage from existing imageUrl values
INSERT INTO "ProductImage" ("id", "productId", "url", "order", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "imageUrl",
    0,
    NOW()
FROM "Product"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" != '';
