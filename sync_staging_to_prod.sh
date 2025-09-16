#!/usr/bin/env bash
set -euo pipefail

# ===== Canary Cards — Sync STAGING → PROD (Schema-Only, Non-Destructive by default) =====
# Source of truth: STAGING (schema), Target: PROD (data preserved)
# Scope: public schema ONLY (ignores Supabase storage)
# Diff engine: Docker + migra
# Flags: --dry-run (preview), --allow-destructive (include drops/renames), --autostash, --discard-local
# Adds enum values (no removals). Conservative timeouts. Code + Edge Functions deploy after DB.

# ===== Flags =====
DRY_RUN=false
ALLOW_DESTRUCTIVE=false
DEBUG=false
AUTOSTASH=false
DISCARD_LOCAL=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --allow-destructive) ALLOW_DESTRUCTIVE=true ;;
    --debug) DEBUG=true ;;
    --autostash) AUTOSTASH=true ;;
    --discard-local) DISCARD_LOCAL=true ;;
    *)
      echo "Usage: $0 [--dry-run] [--allow-destructive] [--debug] [--autostash] [--discard-local]"
      exit 1
      ;;
  esac
done

# ===== Required env =====
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"
: "${PRODUCTION_DB_PASSWORD:?PRODUCTION_DB_PASSWORD is required}"
: "${SUPABASE_STAGING_REF:?SUPABASE_STAGING_REF is required}"     # e.g., pugnjgvdisdbdkbofwrc
: "${SUPABASE_PROD_REF:?SUPABASE_PROD_REF is required}"           # e.g., xwsgyxlvxntgpochonwe

# ===== Git branches (configurable) =====
MAIN_BRANCH="${MAIN_BRANCH:-main}"
REALPROD_BRANCH="${REALPROD_BRANCH:-realproduction}"

# ===== Binaries =====
require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
require docker
require psql
require pg_dump
require supabase
require git

[ "$DEBUG" = true ] && set -x

TS="$(date +%Y%m%d_%H%M%S)"
WORKDIR_REL="backups/${TS}_sync"
mkdir -p "$WORKDIR_REL"

# Turn WORKDIR + pgpass into absolute paths for Docker mounts
abs_path() { cd "$(dirname "$1")" && pwd -P && return; }
WORKDIR="$(cd "$WORKDIR_REL" && pwd -P)"
PGPASS_LOCAL="${WORKDIR}/pgpass"

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

# ===== Build pgpass (absolute path) for Docker =====
cat > "$PGPASS_LOCAL" <<EOF
aws-1-us-east-1.pooler.supabase.com:6543:postgres:postgres.${SUPABASE_STAGING_REF}:${STAGING_DB_PASSWORD}
aws-0-us-west-1.pooler.supabase.com:6543:postgres:postgres.${SUPABASE_PROD_REF}:${PRODUCTION_DB_PASSWORD}
EOF
chmod 600 "$PGPASS_LOCAL"

# ===== Generate schema diff (PROD -> STAGING) with migra =====
DIFF_SQL="${WORKDIR}/sync_diff.sql"
SANITIZED_SQL="${WORKDIR}/sync_diff_sanitized.sql"
MIGRA_FLAGS="--schema public --with-privileges"
[ "$ALLOW_DESTRUCTIVE" = true ] && MIGRA_FLAGS="${MIGRA_FLAGS} --unsafe"

echo "🧮 Generating diff (prod → staging) with migra…"
DOCKER_CMD='pip install --no-cache-dir migra >/dev/null && migra '"$MIGRA_FLAGS"' "$PROD_DSN" "$STAGING_DSN"'

set +e
docker run --rm \
  -v "$PGPASS_LOCAL":/tmp/pgpass:ro \
  -e PGPASSFILE=/tmp/pgpass \
  -e PROD_DSN="$PROD_DSN_KW" \
  -e STAGING_DSN="$STAGING_DSN_KW" \
  python:3.11-slim bash -lc "$DOCKER_CMD" > "$DIFF_SQL"
DOCKER_STATUS=$?
set -e

if [ $DOCKER_STATUS -ne 0 ]; then
  echo "❌ migra (Docker) failed. Common fixes:"
  echo "   • Ensure Docker Desktop is running"
  echo "   • We now pass absolute paths for -v (was the earlier error); if this persists, re-run with --debug"
  exit 1
fi

# ===== Sanitize diff: strip owner changes & ALTER DEFAULT PRIVILEGES =====
if command -v perl >/dev/null 2>&1; then
  perl -0777 -pe '
    s/^\s*ALTER\s+(TABLE|SEQUENCE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|AGGREGATE|TYPE|DOMAIN)\s+.*\sOWNER\s+TO\s+.*?;\s*$//gmi;
    s/^\s*ALTER\s+DEFAULT\s+PRIVILEGES\b.*?;\s*$//gmis;
  ' "$DIFF_SQL" > "$SANITIZED_SQL"
else
  grep -v -E 'OWNER[[:space:]]+TO|^[[:space:]]*ALTER[[:space:]]+DEFAULT[[:space:]]+PRIVILEGES' "$DIFF_SQL" > "$SANITIZED_SQL" || true
fi

# ===== No-op? =====
if ! [ -s "$SANITIZED_SQL" ]; then
  echo "✅ Already in sync (no schema changes)."
  DB_CHANGED=false
else
  DB_CHANGED=true
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
\i ${SANITIZED_SQL}
COMMIT;
SQL
  echo "✅ Schema synced to STAGING truth (public). Data preserved."
fi

# ===== Code deploy (main → realproduction) =====
echo "📦 Deploying code changes ( ${MAIN_BRANCH} → ${REALPROD_BRANCH} )..."
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo "")"

# Handle dirty working tree (chmod +x etc.)
if ! git diff --quiet || ! git diff --cached --quiet; then
  if [ "$DISCARD_LOCAL" = true ]; then
    echo "⚠️  Discarding local changes: git reset --hard && git clean -fd"
    git reset --hard HEAD
    git clean -fd
  elif [ "$AUTOSTASH" = true ]; then
    STASH_NAME="sync_autostash_${TS}"
    echo "📦 Autostashing local changes as: $STASH_NAME"
    git stash push -u -m "$STASH_NAME" >/dev/null
  else
    echo "🛑 Uncommitted changes in working tree."
    echo "   Fix with one of:"
    echo "   • Stash (keep for later):  git stash push -u -m sync_autostash_${TS}"
    echo "   • OR discard everything:   git reset --hard && git clean -fd"
    echo "   • OR commit:               git add -A && git commit -m 'WIP'"
    echo "   Re-run with --autostash or --discard-local to do this automatically."
    exit 1
  fi
fi

git fetch origin --quiet

# Ensure REALPROD branch exists locally (create from remote if needed)
if git show-ref --verify --quiet "refs/heads/${REALPROD_BRANCH}"; then
  git checkout "${REALPROD_BRANCH}" >/dev/null 2>&1
else
  git checkout -b "${REALPROD_BRANCH}" "origin/${REALPROD_BRANCH}" >/dev/null 2>&1 || {
    echo "🛑 Branch ${REALPROD_BRANCH} not found locally or on origin."
    [ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    exit 1
  }
fi

echo "   Merging ${MAIN_BRANCH} into ${REALPROD_BRANCH}…"
if ! git merge "${MAIN_BRANCH}" --no-edit; then
  echo "❌ Merge conflict detected. Resolve manually, then push."
  [ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
  exit 1
fi

echo "   Pushing ${REALPROD_BRANCH}…"
git push origin "${REALPROD_BRANCH}"
echo "✅ Code deployment complete"

# Return to prior branch
[ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true

# If we autostashed, tell the user how to restore
if [ "${AUTOSTASH}" = true ]; then
  echo "ℹ️ Your local edits are stashed as: ${STASH_NAME}"
  echo "   Restore later with: git stash pop \"stash^{/${STASH_NAME}}\""
fi
echo ""

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
