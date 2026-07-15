#!/usr/bin/env bash
# Applies committed Prisma migrations during the Vercel build, and self-heals the
# one-time P3005 case: a production DB created with `db push` has all the tables
# but no _prisma_migrations history, so `migrate deploy` refuses. When that
# happens we baseline the migrations whose schema is already present, then retry.
#
# Safe to run on every build:
#   - fresh/empty DB  -> migrate deploy applies everything, no baseline branch.
#   - already tracked -> migrate deploy is a no-op.
#   - existing/no-history (P3005) -> baseline once, then apply the rest.
set -euo pipefail

# DATABASE_URL points at Neon's pooled (pgbouncer) endpoint, where Postgres
# advisory locks hang until Prisma's 10s timeout (P1002) — the documented
# workaround is to disable the migrate advisory lock. Concurrency-safe here:
# Vercel serializes production builds, so two migrates never race.
export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1

# Migrations that predate migration-tracking — their tables are already in any
# production DB that has served the store. Baselined (recorded, not re-run).
BASELINE=(
  20250808200232_init
  20250808203906_guest_carts
  20251124122208_add_order_details
  20260519154947_add_product_images
)

deploy_with_retry() {
  # One retry with a pause: absorbs Neon cold starts / transient timeouts.
  npx prisma migrate deploy && return 0
  echo "→ migrate deploy failed once; retrying in 15s (Neon cold start?)"
  sleep 15
  npx prisma migrate deploy
}

if output=$(deploy_with_retry 2>&1); then
  echo "$output"
  exit 0
fi

echo "$output"
if echo "$output" | grep -q "P3005"; then
  echo "→ P3005: baselining pre-existing migrations, then retrying"
  for m in "${BASELINE[@]}"; do
    npx prisma migrate resolve --applied "$m"
  done
  deploy_with_retry
else
  echo "migrate deploy failed for a non-P3005 reason (see above)." >&2
  exit 1
fi
