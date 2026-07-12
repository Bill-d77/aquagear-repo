#!/usr/bin/env bash
# One-time recovery for a production database that was created with `prisma db push`
# (no migration history) and now errors P3005 on `prisma migrate deploy`.
#
# It marks the migrations whose schema is ALREADY in the database as applied
# (baselining), then applies the remaining committed migrations. The two newest
# migrations are idempotent (IF NOT EXISTS), so this is safe to run even if some
# of their changes were applied by hand earlier.
#
# Usage:
#   DATABASE_URL="postgres://…your-neon-prod-url…" bash scripts/baseline-prod.sh
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL to the production connection string first." >&2
  exit 1
fi

# These four built the store that has been running in production, so their
# tables definitely exist — record them as applied without re-running.
for m in \
  20250808200232_init \
  20250808203906_guest_carts \
  20251124122208_add_order_details \
  20260519154947_add_product_images; do
  echo "→ baselining $m"
  npx prisma migrate resolve --applied "$m"
done

echo "→ applying remaining migrations"
npx prisma migrate deploy

echo "Done. Production schema is now tracked; future deploys apply migrations automatically."
