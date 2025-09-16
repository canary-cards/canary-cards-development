#!/usr/bin/env bash
set -euo pipefail

# ===== Config =====
SCHEMAS=("public" "storage")   # you confirmed: only these
MIGRATION_ANCHOR="normalize_from_staging"
TS="$(date +%Y%m%d_%H%M%S)"

# ===== Required env =====
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"
: "${PRODUCTION_DB_PASSWORD:?PRODUCTION_DB_PASSWORD is required}"
: "${SUPABASE_STAGING_REF:?SUPABASE_STAGING_REF is required}"     # e.g., pugnjgvdisdbdkbofwrc
: "${SUPABASE_PROD_REF:?SUPABASE_PROD_REF is required}"           # e.g., xwsgyxlvxntgpochonwe
# Optional for functions deploy: SUPABASE_ACCESS_TOKEN=sbp_...

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
require psql; require pg_dump; require supabase

# ===== Keyword DSNs (POOLER ONLY — IPv4, sslmode=require) =====
STAGING_DSN_KW="host=aws-1-us-east-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_STAGING_REF} dbname=postgres sslmode=require"
PROD_DSN_KW="host=aws-0-us-west-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_PROD_REF} dbname=postgres sslmode=require"

echo "🔗 Probing pooler connectivity…"
PGPASSWORD="$STAGING_DB_PASSWORD"   psql "$STAGING_DSN_KW" -c "select 1;" >/dev/null
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW"   -c "select 1;" >/dev/null
echo "   ✅ Pooler connectivity OK"

BACKUP_DIR="backups/${TS}"
mkdir -p "$BACKUP_DIR"

# ===== Backups (for safety) =====
echo "💾 Backing up PROD (schema & data) → ${BACKUP_DIR}"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres --schema-only > "${BACKUP_DIR}/prod_schema.sql"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres --data-only   > "${BACKUP_DIR}/prod_data.sql" || true
# (If you prefer a single full file, swap the two above for one full pg_dump.)

# ===== Dump STAGING schema (exact owned schemas; keep privileges/GRANTs) =====
echo "🧾 Dumping STAGING schema-only for: ${SCHEMAS[*]}"
STAGING_SCHEMA_DUMP="${BACKUP_DIR}/staging_schema_selected.sql"
DUMP_ARGS=(--schema-only)
for s in "${SCHEMAS[@]}"; do DUMP_ARGS+=(--schema="$s"); done
PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_STAGING_REF}" -d postgres "${DUMP_ARGS[@]}" > "$STAGING_SCHEMA_DUMP"

# (Optional but helpful) copy bucket definitions (names/visibility), not objects
echo "🪣 Dumping STAGING bucket definitions…"
STAGING_BUCKETS_DUMP="${BACKUP_DIR}/staging_storage_buckets.sql"
PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_STAGING_REF}" -d postgres \
  --data-only --table=storage.buckets > "$STAGING_BUCKETS_DUMP" \
  || echo "-- no buckets found" > "$STAGING_BUCKETS_DUMP"

# ===== Replace target schemas in PROD (transactional) =====
echo "🧨 Replacing schemas in PROD (only: ${SCHEMAS[*]})…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
$(for s in "${SCHEMAS[@]}"; do echo "DROP SCHEMA IF EXISTS \"$s\" CASCADE; CREATE SCHEMA \"$s\";"; done)
-- Common extensions (safe idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
COMMIT;
SQL

# ===== Apply STAGING schema (single transaction) =====
echo "📥 Applying STAGING schema to PROD…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_SCHEMA_DUMP}
COMMIT;
SQL

# ===== Restore buckets after schema =====
echo "🪣 Restoring bucket definitions to PROD…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_BUCKETS_DUMP}
COMMIT;
SQL

# ===== Normalize migration history (single anchor) =====
echo "🧾 Normalizing migration history (single anchor)…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(
  version text PRIMARY KEY,
  inserted_at timestamptz DEFAULT now()
);
INSERT INTO supabase_migrations.schema_migrations(version)
VALUES ('${MIGRATION_ANCHOR}_${TS}')
ON CONFLICT DO NOTHING;
COMMIT;
SQL

# ===== Edge Functions (secrets managed separately by you) =====
echo "⚡ Deploying Edge Functions to PROD…"
supabase login --token "${SUPABASE_ACCESS_TOKEN:-}" >/dev/null 2>&1 || true
supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null
if [ -d "supabase/functions" ]; then
  for dir in supabase/functions/*; do
    [ -d "$dir" ] || continue
    fn="$(basename "$dir")"
    echo "   • $fn"
    supabase functions deploy "$fn" --project-ref "$SUPABASE_PROD_REF" \
      || echo "     ⚠️ deploy failed for $fn (continuing)"
  done
fi

echo "✅ PROD now mirrors STAGING for schemas: ${SCHEMAS[*]}"
echo "   Backups: ${BACKUP_DIR}"
echo "   Anchor:  ${MIGRATION_ANCHOR}_${TS}"
