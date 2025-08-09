-- PostgreSQL schema for AquaGear4
-- Run in a Postgres DB (ensure appropriate privileges). Adjust extension/owners as needed.

-- Optional: enable pgcrypto if you want gen_random_uuid(); otherwise keep text ids without defaults
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "User" (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'USER',
  createdAt  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Category" (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "Product" (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL,
  price        INTEGER NOT NULL,
  imageUrl     TEXT NOT NULL,
  stock        INTEGER NOT NULL DEFAULT 0,
  categoryId   TEXT NOT NULL REFERENCES "Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  createdAt    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedAt    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simple trigger to keep updatedAt in sync (optional)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_set_updated_at ON "Product";
CREATE TRIGGER product_set_updated_at
BEFORE UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS "Order" (
  id         TEXT PRIMARY KEY,
  userId     TEXT REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL,
  total      INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'PENDING',
  createdAt  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  id         TEXT PRIMARY KEY,
  orderId    TEXT NOT NULL REFERENCES "Order"(id) ON UPDATE CASCADE ON DELETE CASCADE,
  productId  TEXT NOT NULL REFERENCES "Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL,
  price      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Review" (
  id         TEXT PRIMARY KEY,
  userId     TEXT NOT NULL REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE,
  productId  TEXT NOT NULL REFERENCES "Product"(id) ON UPDATE CASCADE ON DELETE CASCADE,
  rating     INTEGER NOT NULL,
  comment    TEXT NOT NULL,
  createdAt  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_product_category ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS idx_order_user ON "Order"("userId");
CREATE INDEX IF NOT EXISTS idx_orderitem_order ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS idx_orderitem_product ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS idx_review_user ON "Review"("userId");
CREATE INDEX IF NOT EXISTS idx_review_product ON "Review"("productId"); 