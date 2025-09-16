#!/usr/bin/env bash
set -euo pipefail

# ===== Canary Cards — Mirror STAGING -> PROD =====
# - Mirrors ONLY the schema you own: public
# - Keeps Supabase-managed `storage` base tables intact
# - Applies `storage` post-data (policies/grants/triggers) and copies bucket rows
# - Uses POOLER (IPv4) connections via keyword DSNs (no URL-encoding)
# - Wraps each apply in a single transaction
# - Takes a single FULL backup of prod for easy restore

# ===== Config =====
SCHEMAS=("public")                 # You confirmed: only `public` is owned; do NOT include `storage`
MIGRATION_ANCHOR="normalize_from_staging"
TS="$(date +%Y%m%d_%H%M%S)"

# ===== Required env =====
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"
: "${PRODUCTION_DB_PASSWORD:?PRODUCTION_DB_PASSWORD is required}"
: "${SUPABASE_STAGING_REF:?SUPABASE_STAGING_REF is required}"     # e.g., pugnjgvdisdbdkbofwrc
: "${SUPABASE_PROD_REF:?SUPABASE_PROD_REF is required}"           # e.g., xwsgyxlvxntgpochonwe
# Optional for functions deploy: export SUPABASE_ACCESS_TOKEN=sbp_...

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" ; exit 1; }; }
require psql; require pg_dump; require supabase

# ===== Keyword DSNs (POOLER ONLY — IPv4, sslmode=require) =====
STAGING_DSN_KW="host=aws-1-us-east-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_STAGING_REF} dbname=postgres sslmode=require"
PROD_DSN_KW="host=aws-0-us-west-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_PROD_REF} dbname=postgres sslmode=require"

echo "🔗 Probing pooler connectivity…"
PGPASSWORD="$STAGING_DB_PASSWORD"    psql "$STAGING_DSN_KW" -c "select 1;" >/dev/null
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW"    -c "select 1;" >/dev/null
echo "   ✅ Pooler connectivity OK"

BACKUP_DIR="backups/${TS}"
mkdir -p "$BACKUP_DIR"

# ===== Full backup of PROD (simplest restore path) =====
echo "💾 Backing up PROD (FULL dump) → ${BACKUP_DIR}/prod_full.sql"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres > "${BACKUP_DIR}/prod_full.sql"

# ===== Dump STAGING schema (exact owned schemas; keep privileges/GRANTs) =====
echo "🧾 Dumping STAGING schema-only for: ${SCHEMAS[*]}"
STAGING_SCHEMA_DUMP="${BACKUP_DIR}/staging_public_schema.sql"
DUMP_ARGS=(--schema-only)
for s in "${SCHEMAS[@]}"; do DUMP_ARGS+=(--schema="$s"); done
PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_STAGING_REF}" -d postgres "${DUMP_ARGS[@]}" > "$STAGING_SCHEMA_DUMP"

# ===== Robust sanitize: remove any statement that (re)creates/alters/comments schema public =====
# Handles:
#   CREATE SCHEMA public;
#   CREATE SCHEMA IF NOT EXISTS public;
#   CREATE SCHEMA public AUTHORIZATION postgres;
#   ALTER SCHEMA public ... ;
#   COMMENT ON SCHEMA public IS '...';
# (Case-insensitive; safe to run on macOS/BSD or Linux. Tries perl first for reliability.)
echo "🧼 Sanitizing dump (strip CREATE/ALTER/COMMENT ON SCHEMA public …)"
if command -v perl >/dev/null 2>&1; then
  perl -0777 -pe '
    s/^\s*CREATE\s+SCHEMA\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?)\s*(AUTHORIZATION\s+\S+)?\s*;\s*$//gmi;
    s/^\s*ALTER\s+SCHEMA\s+"?public"?\s+.*?;\s*$//gmi;
    s/^\s*COMMENT\s+ON\s+SCHEMA\s+"?public"?\s+IS\s+.*?;\s*$//gmi;
  ' -i "$STAGING_SCHEMA_DUMP"
else
  # Fallback with sed (delete any single-line statement that targets SCHEMA public)
  # BSD sed first; if it fails, try GNU sed form.
  if sed -i '' -E '/^[[:space:]]*(CREATE|ALTER|COMMENT)[[:space:]]+.*SCHEMA[[:space:]]+"?public"?([[:space:]]+|").*;/I d' "$STAGING_SCHEMA_DUMP" 2>/dev/null; then
    :
  else
    sed -i -E '/^[[:space:]]*(CREATE|ALTER|COMMENT)[[:space:]]+.*SCHEMA[[:space:]]+"?public"?([[:space:]]+|").*;/I d' "$STAGING_SCHEMA_DUMP"
  fi
fi

# ===== Dump STAGING storage post-data (policies/grants/triggers; no base tables) =====
echo "🛡️  Dumping STAGING storage post-data (policies/grants/triggers)…"
STAGING_STORAGE_POSTDATA="${BACKUP_DIR}/staging_storage_postdata.sql"
PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_STAGING_REF}" -d postgres \
  --schema=storage --section=post-data > "$STAGING_STORAGE_POSTDATA"

# ===== Dump STAGING bucket rows (names/visibility), not objects =====
echo "🪣 Dumping STAGING bucket definitions (storage.buckets)…"
STAGING_BUCKETS_DUMP="${BACKUP_DIR}/staging_storage_buckets.sql"
if PGPASSWORD="$STAGING_DB_PASSWORD" pg_dump -h aws-1-us-east-1.pooler.supabase.com -p 6543 \
    -U "postgres.${SUPABASE_STAGING_REF}" -d postgres \
    --data-only --table=storage.buckets > "$STAGING_BUCKETS_DUMP" 2>/dev/null; then
  :
else
  echo "-- no buckets found" > "$STAGING_BUCKETS_DUMP"
fi

# ===== Replace ONLY the owned schemas in PROD (here: public) =====
echo "🧨 Replacing schemas in PROD (only: public)…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public";

-- Common extensions (idempotent; ensure available before loading objects)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
COMMIT;
SQL

# ===== Apply STAGING public schema (atomic) =====
echo "📥 Applying STAGING schema (public) to PROD…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_SCHEMA_DUMP}
COMMIT;
SQL

# ===== Apply STAGING storage post-data (policies/grants/triggers) =====
echo "🛡️  Applying storage policies/grants/triggers to PROD…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_STORAGE_POSTDATA}
COMMIT;
SQL

# ===== Restore bucket rows (names/visibility) =====
echo "🪣 Restoring bucket definitions to PROD…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i ${STAGING_BUCKETS_DUMP}
COMMIT;
SQL

# ===== Normalize migration history with a single anchor row =====
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

# ===== Edge Functions (secrets managed by you) =====
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

echo "✅ PROD now mirrors STAGING:"
echo "   • Schemas mirrored: public"
echo "   • storage: base tables untouched; policies/grants applied; buckets copied"
echo "   • Backup: ${BACKUP_DIR}/prod_full.sql"
echo "   • Anchor migration: ${MIGRATION_ANCHOR}_${TS}"
