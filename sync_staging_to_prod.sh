#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Canary Cards — Sync STAGING → PROD (Schema-only, Safe-by-default)
#
# What this does (non-destructive by default):
#   • Diffs the STAGING database schema (public) against PROD using Docker + migra
#   • Applies only ADDITIVE changes by default (new tables/columns/indexes, enum values)
#   • Preserves all existing PROD data
#   • Then deploys code: merges `main` → `realproduction` and pushes
#   • Then deploys Supabase Edge Functions
#
# What this does NOT do:
#   • Does NOT touch the `storage` schema (policies/grants/ownership there are Supabase-managed)
#   • Does NOT drop/rename columns/tables unless you opt in with --allow-destructive
#
# Quick examples:
#   DRY RUN (preview only):   ./sync_staging_to_prod.sh --dry-run
#   Normal sync:              ./sync_staging_to_prod.sh
#   Allow drops/renames:      ./sync_staging_to_prod.sh --allow-destructive
#   Auto-stash local edits:   ./sync_staging_to_prod.sh --autostash
#   Discard local edits:      ./sync_staging_to_prod.sh --discard-local
#
# Required environment variables:
#   export STAGING_DB_PASSWORD=********
#   export PRODUCTION_DB_PASSWORD=********
#   export SUPABASE_STAGING_REF=pugnjgvdisdbdkbofwrc
#   export SUPABASE_PROD_REF=xwsgyxlvxntgpochonwe
# Optional (for Edge Functions deploy):
#   export SUPABASE_ACCESS_TOKEN=sbp_************************
#
# Dependencies (CLI tools):
#   docker, psql, pg_dump, supabase, git
#   - macOS tips:
#       brew install postgresql  # psql/pg_dump
#       brew install supabase/tap/supabase
#       Install Docker Desktop & start it
#
# Flags:
#   --dry-run           Show the SQL diff; don't apply it
#   --allow-destructive Include DROPs/renames (uses migra --unsafe)
#   --autostash         Stash any local git changes before code deploy
#   --discard-local     Reset & clean local repo before code deploy (DANGEROUS)
#   --debug             Verbose output for troubleshooting
#   --help              Print this banner and exit
#
# Limitations / gotchas:
#   • Only the `public` schema is synced.
#   • `storage` is intentionally ignored (ownership/privileges differ in Supabase).
#   • Enum handling: we add new values; removals/renames require --allow-destructive.
#   • Destructive diffs are wrapped in a transaction but you should use with care.
# ==============================================================================

# ---------- Configurable branches ----------
MAIN_BRANCH="${MAIN_BRANCH:-main}"
REALPROD_BRANCH="${REALPROD_BRANCH:-realproduction}"

# ---------- Flags ----------
DRY_RUN=false
ALLOW_DESTRUCTIVE=false
DEBUG=false
AUTOSTASH=false
DISCARD_LOCAL=false
SHOW_HELP=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --allow-destructive) ALLOW_DESTRUCTIVE=true ;;
    --debug) DEBUG=true ;;
    --autostash) AUTOSTASH=true ;;
    --discard-local) DISCARD_LOCAL=true ;;
    --help|-h) SHOW_HELP=true ;;
    *)
      echo "Unknown option: $arg"
      SHOW_HELP=true
      ;;
  esac
done

print_help() {
  sed -n '1,130p' "$0" | sed 's/^# \{0,1\}//' | sed 's/^#*$//'
}

[ "$SHOW_HELP" = true ] && { print_help; exit 0; }

# ---------- Friendly checks & guidance ----------
info()  { echo -e "🟦 $*"; }
ok()    { echo -e "✅ $*"; }
warn()  { echo -e "⚠️  $*"; }
fail()  { echo -e "🛑 $*"; exit 1; }

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    case "$1" in
      psql|pg_dump) fail "Missing $1. On macOS: brew install postgresql";;
      supabase)     fail "Missing supabase CLI. On macOS: brew install supabase/tap/supabase";;
      docker)       fail "Missing Docker. Install Docker Desktop and start it."; ;
      git)          fail "Missing git. Install Xcode CLT (xcode-select --install) or brew install git.";;
      *)            fail "Missing $1. Please install it."; ;
    esac
  fi
}

require_bin docker
require_bin psql
require_bin pg_dump
require_bin supabase
require_bin git

# Is Docker running?
if ! docker info >/dev/null 2>&1; then
  fail "Docker is installed but not running. Please open Docker Desktop and retry."
fi
ok "Dependencies check passed."

# ---------- Required env with guidance ----------
need_env() {
  local var="$1" example="$2"
  if [ -z "${!var:-}" ]; then
    warn "$var is not set."
    echo "  Set it like:"
    echo "     export $var=$example"
    MISSING_ENV=true
  fi
}

MISSING_ENV=false
need_env "STAGING_DB_PASSWORD"     "your_staging_db_password"
need_env "PRODUCTION_DB_PASSWORD"  "your_prod_db_password"
need_env "SUPABASE_STAGING_REF"    "pugnjgvdisdbdkbofwrc"
need_env "SUPABASE_PROD_REF"       "xwsgyxlvxntgpochonwe"

if [ "$MISSING_ENV" = true ]; then
  echo
  fail "Missing required environment variables. See guidance above, then re-run. (Use --help for full docs.)"
fi

[ "$DEBUG" = true ] && set -x

TS="$(date +%Y%m%d_%H%M%S)"
WORKDIR="backups/${TS}_sync"
mkdir -p "$WORKDIR"

# ---------- DSNs (POOLER IPv4) — no passwords embedded ----------
STAGING_DSN_KW="host=aws-1-us-east-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_STAGING_REF} dbname=postgres sslmode=require"
PROD_DSN_KW="host=aws-0-us-west-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_PROD_REF} dbname=postgres sslmode=require"

info "Probing database connectivity (pooler)…"
PGPASSWORD="$STAGING_DB_PASSWORD"    psql "$STAGING_DSN_KW" -c "select 1;" >/dev/null
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW"    -c "select 1;" >/dev/null
ok "DB connectivity OK."

# ---------- Safety backup ----------
info "Backing up PROD (FULL) → ${WORKDIR}/prod_full.sql"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres > "${WORKDIR}/prod_full.sql"
ok "Backup complete."

# ---------- pgpass for Docker (avoid passing passwords in URLs) ----------
PGPASS_LOCAL="${WORKDIR}/pgpass"
cat > "$PGPASS_LOCAL" <<EOF
aws-1-us-east-1.pooler.supabase.com:6543:postgres:postgres.${SUPABASE_STAGING_REF}:${STAGING_DB_PASSWORD}
aws-0-us-west-1.pooler.supabase.com:6543:postgres:postgres.${SUPABASE_PROD_REF}:${PRODUCTION_DB_PASSWORD}
EOF
chmod 600 "$PGPASS_LOCAL"

# ---------- Diff (PROD → STAGING) with migra in Docker ----------
DIFF_SQL="${WORKDIR}/sync_diff.sql"
SANITIZED_SQL="${WORKDIR}/sync_diff_sanitized.sql"
MIGRA_FLAGS="--schema public --with-privileges"
[ "$ALLOW_DESTRUCTIVE" = true ] && MIGRA_FLAGS="${MIGRA_FLAGS} --unsafe"

info "Generating schema diff (prod → staging) with migra…"
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
[ $DOCKER_STATUS -ne 0 ] && fail "migra (Docker) failed. Run with --debug and share the output."

# ---------- Sanitize: strip owner changes & ALTER DEFAULT PRIVILEGES ----------
if command -v perl >/dev/null 2>&1; then
  perl -0777 -pe '
    s/^\s*ALTER\s+(TABLE|SEQUENCE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|AGGREGATE|TYPE|DOMAIN)\s+.*\sOWNER\s+TO\s+.*?;\s*$//gmi;
    s/^\s*ALTER\s+DEFAULT\s+PRIVILEGES\b.*?;\s*$//gmis;
  ' "$DIFF_SQL" > "$SANITIZED_SQL"
else
  grep -v -E 'OWNER[[:space:]]+TO|^[[:space:]]*ALTER[[:space:]]+DEFAULT[[:space:]]+PRIVILEGES' "$DIFF_SQL" > "$SANITIZED_SQL" || true
fi

# ---------- Apply or no-op ----------
if [ ! -s "$SANITIZED_SQL" ]; then
  ok "Already in sync (no schema changes)."
else
  echo "🗂️  Diff saved to:   $DIFF_SQL"
  echo "🧹 Sanitized diff:   $SANITIZED_SQL"
  if [ "$DRY_RUN" = true ]; then
    info "Dry run: no DB changes applied."
    exit 0
  fi

  info "Ensuring common extensions on PROD… (idempotent)"
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

  info "Applying schema sync to PROD (atomic, conservative timeouts)…"
  PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
\i ${SANITIZED_SQL}
COMMIT;
SQL
  ok "Schema synced to STAGING truth (public). Data preserved."
fi

# ---------- Code deploy: main → realproduction ----------
info "Deploying code ( ${MAIN_BRANCH} → ${REALPROD_BRANCH} )…"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo "")"

if ! git diff --quiet || ! git diff --cached --quiet; then
  if [ "$DISCARD_LOCAL" = true ]; then
    warn "Discarding local changes: git reset --hard && git clean -fd"
    git reset --hard HEAD
    git clean -fd
  elif [ "$AUTOSTASH" = true ]; then
    STASH_NAME="sync_autostash_${TS}"
    info "Autostashing local changes as: $STASH_NAME"
    git stash push -u -m "$STASH_NAME" >/dev/null
  else
    fail "Uncommitted changes detected. Re-run with --autostash or --discard-local, or commit/stash manually."
  fi
fi

git fetch origin --quiet
if git show-ref --verify --quiet "refs/heads/${REALPROD_BRANCH}"; then
  git checkout "${REALPROD_BRANCH}" >/dev/null 2>&1
else
  git checkout -b "${REALPROD_BRANCH}" "origin/${REALPROD_BRANCH}" >/dev/null 2>&1 || {
    [ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    fail "Branch ${REALPROD_BRANCH} not found locally or on origin."
  }
fi

echo "   Merging ${MAIN_BRANCH} into ${REALPROD_BRANCH}…"
if ! git merge "${MAIN_BRANCH}" --no-edit; then
  [ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
  fail "Merge conflict detected. Resolve & push manually."
fi

echo "   Pushing ${REALPROD_BRANCH}…"
git push origin "${REALPROD_BRANCH}"
ok "Code deployment complete."
[ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
[ "${AUTOSTASH}" = true ] && echo "ℹ️  Your local edits are stashed as: ${STASH_NAME} (restore with: git stash pop \"stash^{/${STASH_NAME}}\")"
echo

# ---------- Edge Functions deploy ----------
info "Deploying Supabase Edge Functions…"
supabase login --token "${SUPABASE_ACCESS_TOKEN:-}" >/dev/null 2>&1 || true
supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null
if [ -d "supabase/functions" ]; then
  for dir in supabase/functions/*; do
    [ -d "$dir" ] || continue
    fn="$(basename "$dir")"
    echo "   • $fn"
    supabase functions deploy "$fn" --project-ref "$SUPABASE_PROD_REF" || echo "     ⚠️  $fn deploy failed (continuing)"
  done
fi

echo "🎉 Done."
echo "   Backup:        ${WORKDIR}/prod_full.sql"
echo "   Raw diff:      ${DIFF_SQL}"
echo "   Sanitized diff:${SANITIZED_SQL}"
echo "   Destructive:   $ALLOW_DESTRUCTIVE (use --allow-destructive to include drops/renames)"
