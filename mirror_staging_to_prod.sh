#!/usr/bin/env bash
set -euo pipefail

# ===== Canary Cards — Mirror STAGING -> PROD =====
# - Mirrors ONLY schema you own: public
# - Keeps Supabase-managed storage base tables intact
# - Applies storage post-data (policies/grants) for storage.objects ONLY (skips buckets to avoid ownership errors)
# - Copies bucket rows (names/visibility), not files
# - Uses POOLER (IPv4) keyword DSNs (no URL-encoding)
# - Single FULL backup of prod
# - All changes applied in transactions

# ===== Config =====
SCHEMAS=("public")                 # you confirmed: only `public` is owned; do NOT include `storage`
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

# ===== Robust sanitize: remove schema-public DDL & ALL ALTER DEFAULT PRIVILEGES =====
echo "🧼 Sanitizing dump (strip CREATE/ALTER/COMMENT SCHEMA public + ALTER DEFAULT PRIVILEGES)…"
if command -v perl >/dev/null 2>&1; then
  perl -0777 -pe '
    s/^\s*CREATE\s+SCHEMA\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?)\s*(AUTHORIZATION\s+\S+)?\s*;\s*$//gmi;
    s/^\s*ALTER\s+SCHEMA\s+"?public"?\s+.*?;\s*$//gmi;
    s/^\s*COMMENT\s+ON\s+SCHEMA\s+"?public"?\s+IS\s+.*?;\s*$//gmi;
    s/^\s*ALTER\s+DEFAULT\s+PRIVILE*
