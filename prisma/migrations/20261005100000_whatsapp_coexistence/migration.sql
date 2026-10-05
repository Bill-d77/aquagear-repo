-- WhatsApp Business app coexistence. Additive only: new nullable columns, one
-- boolean with a constant default (metadata-only on Postgres 11+), new indexes.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "phoneE164" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "bsuid" TEXT,
ADD COLUMN     "contactName" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "isHistorical" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Order_phoneE164_idx" ON "Order"("phoneE164");

-- CreateIndex
CREATE INDEX "Conversation_phone_idx" ON "Conversation"("phone");

-- CreateIndex (NULLs are distinct, so existing rows without a BSUID don't collide)
CREATE UNIQUE INDEX "Conversation_channel_bsuid_key" ON "Conversation"("channel", "bsuid");
