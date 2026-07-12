ALTER TABLE "Product" ADD COLUMN "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN "gtin" TEXT;
ALTER TABLE "Product" ADD COLUMN "mpn" TEXT;
ALTER TABLE "Product" ADD COLUMN "condition" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "Product" ADD COLUMN "googleProductCategory" TEXT;
