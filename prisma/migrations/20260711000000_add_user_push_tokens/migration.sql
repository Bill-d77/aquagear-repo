-- APNs device tokens for the admin apps' new-order pushes.
ALTER TABLE "User" ADD COLUMN "pushTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
