-- Deduplicate reviews (keep the newest per user+product) before adding the constraint.
DELETE FROM "Review" a
USING "Review" b
WHERE a."userId" = b."userId"
  AND a."productId" = b."productId"
  AND (a."createdAt" < b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- Delivery fee becomes settings-driven. The live store charges $4 today, so
-- promote the untouched default (0) to 400 to preserve current behavior.
UPDATE "StoreSettings" SET "shippingFlatRate" = 400
WHERE "id" = 'singleton' AND "shippingFlatRate" = 0;

ALTER TABLE "StoreSettings" ALTER COLUMN "shippingFlatRate" SET DEFAULT 400;
