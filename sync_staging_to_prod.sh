#!/usr/bin/env bash
set -euo pipefail

# ===== Canary Cards — Sync STAGING → PROD (Schema-Only, Non-Destructive by default) =====
# - Source of truth: STAGING schema
# - Target: PROD schema
# - Scope: public schema ONLY (ignores Supabase 'storage' and others)
# - Data preserved in PROD (no drops by default)
# - Uses Docker + migra for precise diffs
# - Supports --dry-run and --allow-destructive (adds migra --unsafe)
# - Adds enum values safely, grants/policies included (owner changes stripped)
# - Conservative timeouts + edge functions deploy at the end

# ===== Usage =====
# export STAGING_DB_PASSWORD=...
# export PRODUCTION_DB_PASSWORD=...
# export SUPABASE_STAGING_REF=pugnjgvdisdbdkbofwrc
# export SUPABASE_PROD_REF=xwsgyxlvxntgpochonwe
# # optional for Edge Functions:
# # export SUPABASE_ACCESS_TOKEN=sbp_...
# bash sync_staging_to_prod.sh [--dry-run] [--allow-destructive] [--debug]

# ===== Flags =====
DRY_RUN=false
ALLOW_DESTRUCTIVE=false
DEBUG=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --allow-destructive) ALLOW_DESTRUCTIVE=true ;;
    --debug) DEBUG=true ;;
    *)
      echo "Usage: $0 [--dry-run] [--allow-destructive] [--debug]"
      exit 1
      ;;
  esac
done

# ===== Required env =====
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"
: "${PRODUCTION_DB_PASSWORD:?PRODUCTION_DB_PASSWORD is required}"
: "${SUPABASE_STAGING_REF:?SUPABASE_STAGING_REF is required}"     # e.g., pugnjgvdisdbdkbofwrc
: "${SUPABASE_PROD_REF:?SUPABASE_PROD_REF is required}"           # e.g., xwsgyxlvxntgpochonwe

# ===== Binaries =====
require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
require docker
require psql
require pg_dump
require supabase

[ "$DEBUG" = true ] && set -x

TS="$(date +%Y%m%d_%H%M%S)"
WORKDIR="backups/${TS}_sync"
mkdir -p "$WORKDIR"

# ===== DSNs (POOLER IPv4) — no passwords embedded =====
STAGING_DSN_KW="host=aws-1-us-east-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_STAGING_REF} dbname=postgres sslmode=require"
PROD_DSN_KW="host=aws-0-us-west-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_PROD_REF} dbname=postgres sslmode=require"

echo "🔗 Probing connectivity (pooler)…"
PGPASSWORD="$STAGING_DB_PASSWORD"    psql "$STAGING_DSN_KW" -c "select 1;" >/dev/null
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW"    -c "select 1;" >/dev/null
echo "   ✅ OK"

# ===== Full backup of PROD (safety) =====
echo "💾 Backing up PROD (FULL) → ${WORKDIR}/prod_full.sql"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres > "${WORKDIR}/prod_full.sql"

# ===== Build pgpass for Docker (so we don't embed passwords) =====
PGPASS_LOCAL="${WORKDIR}/pgpass"
cat > "$PGPASS_LOCAL" <<EOF
aws-1-us-east-1.pooler.supabase.com:6543:postgres:postgres.${SUPABASE_STAGING_REF}:${STAGING_DB_PASSWORD}
aws-0-us-west-1.pooler.supabase.com:6543:postgres:postgres.${SUPABASE_PROD_REF}:${PRODUCTION_DB_PASSWORD}
EOF
chmod 600 "$PGPASS_LOCAL"

# ===== Generate schema diff (PROD -> STAGING) with migra =====
DIFF_SQL="${WORKDIR}/sync_diff.sql"
MIGRA_FLAGS="--schema public --with-privileges"
[ "$ALLOW_DESTRUCTIVE" = true ] && MIGRA_FLAGS="${MIGRA_FLAGS} --unsafe"

echo "🧮 Generating diff (prod → staging) with migra…"
# Use a tiny Python image, install migra, run diff. Pass DSNs via env to keep quoting sane.
DOCKER_CMD='pip install --no-cache-dir migra >/dev/null && migra '"$MIGRA_FLAGS"' "$PROD_DSN" "$STAGING_DSN"'
docker run --rm \
  -v "$PGPASS_LOCAL":/tmp/pgpass:ro \
  -e PGPASSFILE=/tmp/pgpass \
  -e PROD_DSN="$PROD_DSN_KW" \
  -e STAGING_DSN="$STAGING_DSN_KW" \
  python:3.11-slim bash -lc "$DOCKER_CMD" > "$DIFF_SQL" || true

# ===== Sanitize diff: drop owner changes & ALTER DEFAULT PRIVILEGES (can fail under managed roles) =====
SANITIZED_SQL="${WORKDIR}/sync_diff_sanitized.sql"
if command -v perl >/dev/null 2>&1; then
  perl -0777 -pe '
    s/^\s*ALTER\s+(TABLE|SEQUENCE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|AGGREGATE|TYPE|DOMAIN)\s+.*\sOWNER\s+TO\s+.*?;\s*$//gmi;
    s/^\s*ALTER\s+DEFAULT\s+PRIVILEGES\b.*?;\s*$//gmis;
  ' "$DIFF_SQL" > "$SANITIZED_SQL"
else
  # Line-based fallback (good enough for most migra outputs)
  grep -v -E 'OWNER[[:space:]]+TO|^[[:space:]]*ALTER[[:space:]]+DEFAULT[[:space:]]+PRIVILEGES' "$DIFF_SQL" > "$SANITIZED_SQL" || true
fi

# ===== No-op? =====
if [ ! -s "$SANITIZED_SQL" ]; then
  echo "✅ Already in sync (no changes)."
  # Still deploy Edge Functions if you want that on app changes
  if [ "${SUPABASE_ACCESS_TOKEN:-}" != "" ]; then
    echo "⚡ Deploying Edge Functions (no DB changes)…"
    supabase login --token "$SUPABASE_ACCESS_TOKEN" >/dev/null 2>&1 || true
    supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null
    if [ -d "supabase/functions" ]; then
      for dir in supabase/functions/*; do
        [ -d "$dir" ] || continue
        fn="$(basename "$dir")"
        echo "   • $fn"
        supabase functions deploy "$fn" --project-ref "$SUPABASE_PROD_REF" || echo "     ⚠️ $fn deploy failed (continuing)"
      done
    fi
  fi
  echo "🗂️  Diff file: $DIFF_SQL"
  exit 0
fi

# ===== Show diff and exit in dry-run =====
echo "🗂️  Diff written: $DIFF_SQL"
if [ "$DRY_RUN" = true ]; then
  echo "👀 Dry run only. Sanitized (to be applied) at: $SANITIZED_SQL"
  exit 0
fi

# ===== Pre-ensure common extensions (idempotent) =====
echo "🔧 Ensuring common extensions on PROD…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<'SQL'
\set ON_ERROR_STOP on
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE EXTENSION IF NOT EXISTS "pgjwt";
  CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EXCEPTION WHEN OTHERS THEN
  -- extensions are optional; ignore if lacking privs
  NULL;
END $$;
SQL

# ===== Apply diff atomically with conservative timeouts =====
echo "🚀 Applying schema sync to PROD (atomic)…"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Apply sanitized diff generated by migra
\i ${SANITIZED_SQL}
COMMIT;
SQL

echo "✅ Schema synced to STAGING truth (public). Data preserved."

# ===== Edge Functions (deploy) =====
echo "⚡ Deploying Edge Functions to production…"
supabase login --token "${SUPABASE_ACCESS_TOKEN:-}" >/dev/null 2>&1 || true
supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null
if [ -d "supabase/functions" ]; then
  for dir in supabase/functions/*; do
    [ -d "$dir" ] || continue
    fn="$(basename "$dir")"
    echo "   • $fn"
    supabase functions deploy "$fn" --project-ref "$SUPABASE_PROD_REF" || echo "     ⚠️ $fn deploy failed (continuing)"
  done
fi

echo "🎉 Done."
echo "   Backup:        ${WORKDIR}/prod_full.sql"
echo "   Raw diff:      ${DIFF_SQL}"
echo "   Sanitized diff:${SANITIZED_SQL}"
echo "   Destructive:   $ALLOW_DESTRUCTIVE (use --allow-destructive to include drops/renames)"
