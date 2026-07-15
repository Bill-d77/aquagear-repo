CREATE TABLE IF NOT EXISTS "PageView" (
  "id" TEXT NOT NULL,
  "anonId" TEXT,
  "path" TEXT NOT NULL,
  "country" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView"("path");
