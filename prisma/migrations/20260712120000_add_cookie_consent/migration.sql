-- CreateTable
CREATE TABLE IF NOT EXISTS "CookieConsent" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "userId" TEXT,
    "version" INTEGER NOT NULL,
    "functional" BOOLEAN NOT NULL,
    "analytics" BOOLEAN NOT NULL,
    "marketing" BOOLEAN NOT NULL,
    "country" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CookieConsent_anonId_idx" ON "CookieConsent"("anonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CookieConsent_createdAt_idx" ON "CookieConsent"("createdAt");
