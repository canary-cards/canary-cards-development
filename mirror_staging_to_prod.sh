#!/usr/bin/env bash
set -euo pipefail

# === Config (edit if you add more owned schemas) ===
SCHEMAS=("public" "storage")   # you said: only these
MIGRATION_ANCHOR="normalize_from_staging"
TS="$(date +%Y%m%d_%H%M%S)"

# === Required env ===
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"
: "${PRODUCTION_DB_PASSWORD:?PRODUCTION_DB_PASSWORD is required}"
: "${SUPABASE_STAGING_REF:?SUPABASE_STAGING_REF is required}"     # e.g., pugnjgvdisdbdkbofwrc
: "${SUPABASE_PROD_REF:?SUPABASE_PROD_REF is required}"           # e.g., xwsgyxlvxntgpochonwe
# Optional: SUPABASE_ACCESS_TOKEN for functions deploy

# --- helpers ---
require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" ; exit 1; }; }
require psql; require pg_dump; require supabase

# URL-encode (bash-only)
url_encode() {
  local s="$1" out="" c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) printf -v out '%s%%%02X' "$out" "'$c" ;;
    esac
  done
  echo "$out"
}

ENC_STG_PW="$(url_encode "$STAGING_DB_PASSWORD")"
ENC_PRD_PW="$(url_encode "$PRODUCTION_DB_PASSWORD")"

# Pooler (6543) for dumps, Direct (5432) for DDL
STAGING_POOLER="postgresql://postgres.${SUPABASE_STAGING_REF}:${ENC_STG_PW}@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
PROD_POOLER="postgresql://postgres.${SUPABASE_PROD_REF}:${ENC_PRD_PW}@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require"

STAGING_DIRECT="postgresql://postgres.${SUPABASE_STAGING_REF}:${ENC_STG_PW}@db.${SUPABASE_STAGING_REF}.supabase.co:5432/postgres"
PROD_DIRECT="postgresql://postgres.${SUPABASE_PROD_REF}:${ENC_PRD_PW}@db.${SUPABASE_PROD_REF}.supabase.co:5432/postgres"

BACKUP_DIR="backups/${TS}"
mkdir -p "$BACKUP_DIR"

echo "💾 Backing up PROD (schema & data) → ${BACKUP_DIR}"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres --schema-only > "${BACKUP_DIR}/prod_schema.sql"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres --data-only   > "${BACKUP_DIR}/prod_data.sql" || true

# Dump staging schema-only for exactly the owned schemas (keep privileges!)
echo "🧾 Dumping STAGING schema-only for: ${SCHEMAS[*]}"
STAGING_SCHEMA_DUMP="${BACKUP_DIR}/staging_schema_selected.sql"
DUMP_ARGS=(--schema-only)
for s in "${SCHEMAS[@]}"; do DUMP_ARGS+=(--schema="$s"); done
PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_STAGING_REF}" -d postgres "${DUMP_ARGS[@]}" > "$STAGING_SCHEMA_DUMP"

# ALSO copy bucket definitions (data-only for storage.buckets), optional but recommended
echo "🪣 Dumping STAGING bucket definitions (storage.buckets)…"
STAGING_BUCKETS_DUMP="${BACKUP_DIR}/staging_storage_buckets.sql"
PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_STAGING_REF}" -d postgres \
  --data-only --table=storage.buckets > "$STAGING_BUCKETS_DUMP" || echo "-- no buckets found" > "$STAGING_BUCKETS_DUMP"

# Replace target schemas in PROD (transactional)
echo "🧨 Replacing schemas in PROD (only: ${SCHEMAS[*]})…"
psql "$PROD_DIRECT" <<SQL
\set ON_ERROR_STOP on
BEGIN;
$(for s in "${SCHEMAS[@]}"; do echo "DROP SCHEMA IF EXISTS \"$s\" CASCADE; CREATE SCHEMA \"$s\";"; done)
-- Common extensions (safe if already present; keep out of auth)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
COMMIT;
SQL

# Apply staging schema dump inside a single transaction
echo "📥 Applying STAGING schema to PROD (single transaction)…"
psql "$PROD_DIRECT" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_SCHEMA_DUMP}
COMMIT;
SQL

# Restore buckets (data) after schema is in place
echo "🪣 Restoring bucket definitions to PROD…"
psql "$PROD_DIRECT" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_BUCKETS_DUMP}
COMMIT;
SQL

# Normalize migration history with a single anchor row
echo "🧾 Normalizing migration history (single anchor)…"
psql "$PROD_DIRECT" <<SQL
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  inserted_at timestamptz DEFAULT now()
);
INSERT INTO supabase_migrations.schema_migrations(version)
VALUES ('${MIGRATION_ANCHOR}_${TS}')
ON CONFLICT DO NOTHING;
COMMIT;
SQL

# Edge functions deploy (user manages secrets separately)
echo "⚡ Deploying Edge Functions to PROD…"
supabase login --token "${SUPABASE_ACCESS_TOKEN:-}" >/dev/null 2>&1 || true
supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null
if [ -d "supabase/functions" ]; then
  for dir in supabase/functions/*; do
    [ -d "$dir" ] || continue
    fn="$(basename "$dir")"
    echo "   • $fn"
    supabase functions deploy "$fn" --project-ref "$SUPABASE_PROD_REF" || echo "     ⚠️ deploy failed for $fn (continuing)"
  done
fi

echo "✅ PROD mirrors STAGING for schemas: ${SCHEMAS[*]}"
echo "   Backups: ${BACKUP_DIR}"
echo "   Anchor:  ${MIGRATION_ANCHOR}_${TS}"
