#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Canary Cards — Sync STAGING → PROD (Schema-only, Safe-by-default)
# Interactive helper for non-technical teammates.
#
# What it does:
#   • Diffs STAGING → PROD for schema changes (public schema only) using Docker + migra
#   • Applies ADDITIVE changes by default (new tables/columns/indexes, enum values)
#   • Preserves PROD data
#   • Deploys code (merge main → realproduction) and then Supabase Edge Functions
#
# What it does NOT do:
#   • Does NOT touch Supabase-managed `storage` schema (policies/grants/ownership)
#   • Does NOT drop/rename objects unless you opt in to "allow destructive"
#
# You can also pass flags (for automation/CI) to skip the interactive prompts:
#   --dry-run            Show the SQL diff; don't apply it
#   --allow-destructive  Include DROPs/renames (migra --unsafe)
#   --autostash          Stash local git edits automatically before code deploy
#   --discard-local      Reset & clean local repo before code deploy (DANGEROUS)
#   --debug              Verbose output
#   --help               Print this banner and exit
#
# Required env vars (the script will prompt if missing):
#   STAGING_DB_PASSWORD, PRODUCTION_DB_PASSWORD, SUPABASE_STAGING_REF, SUPABASE_PROD_REF
# Optional:
#   SUPABASE_ACCESS_TOKEN (for Edge Functions deploy)
#
# Dependencies (the script checks for these and explains how to install):
#   docker, psql, pg_dump, supabase, git
# ==============================================================================

# ---------- Configurable branches ----------
MAIN_BRANCH="${MAIN_BRANCH:-main}"
REALPROD_BRANCH="${REALPROD_BRANCH:-realproduction}"

# ---------- CLI flags (non-interactive override) ----------
DRY_RUN=false
ALLOW_DESTRUCTIVE=false
DEBUG=false
AUTOSTASH=false
DISCARD_LOCAL=false
SHOW_HELP=false
for arg in "${@:-}"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --allow-destructive) ALLOW_DESTRUCTIVE=true ;;
    --debug) DEBUG=true ;;
    --autostash) AUTOSTASH=true ;;
    --discard-local) DISCARD_LOCAL=true ;;
    --help|-h) SHOW_HELP=true ;;
    *) echo "Unknown option: $arg"; SHOW_HELP=true ;;
  esac
done

print_help() {
  sed -n '1,160p' "$0" | sed 's/^# \{0,1\}//' | sed 's/^#*$//'
}
[ "$SHOW_HELP" = true ] && { print_help; exit 0; }

# ---------- UX helpers ----------
say()  { echo -e "$*"; }
info() { echo -e "🟦 $*"; }
ok()   { echo -e "✅ $*"; }
warn() { echo -e "⚠️  $*"; }
fail() { echo -e "🛑 $*"; exit 1; }

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    case "$1" in
      psql|pg_dump) fail "Missing $1. On macOS: brew install postgresql" ;;
      supabase)     fail "Missing supabase CLI. On macOS: brew install supabase/tap/supabase" ;;
      docker)       fail "Missing Docker. Install Docker Desktop and start it." ;;
      git)          fail "Missing git. Install Xcode CLT (xcode-select --install) or brew install git." ;;
      *)            fail "Missing $1. Please install it." ;;
    esac
  fi
}

# ---------- Check dependencies ----------
require_bin docker
require_bin psql
require_bin pg_dump
require_bin supabase
require_bin git
if ! docker info >/dev/null 2>&1; then
  fail "Docker is installed but not running. Open Docker Desktop and retry."
fi

# ---------- Gather env (prompt if missing) ----------
prompt_if_empty() {
  local var="$1" prompt="$2" silent="${3:-false}"
  if [ -z "${!var:-}" ]; then
    if [ "$silent" = true ]; then
      read -r -s -p "   $prompt: " value; echo
    else
      read -r -p "   $prompt: " value
    fi
    [ -z "${value:-}" ] && fail "$var cannot be empty."
    export "$var=$value"
  fi
}

say ""
say "🧭 Canary Cards — Sync STAGING → PROD (public schema only)"
say "-----------------------------------------------------------"
say "This tool keeps PROD schema in sync with STAGING without touching PROD data."
say ""
say "What you'll choose next:"
say "  1) Dry run vs Apply"
say "  2) Whether to allow destructive changes (drops/renames) — default: NO"
say "  3) How to handle local git edits for the code deploy step"
say ""
say "Limitations:"
say "  • Only the 'public' schema is synced"
say "  • Supabase 'storage' schema is ignored"
say "  • Destructive changes require explicit opt-in"
say ""

# Prompt for env vars if missing
say "🔑 Environment:"
say "   (Press Enter to keep current value if already set)"
prompt_if_empty "SUPABASE_STAGING_REF"   "SUPABASE_STAGING_REF (e.g., pugnjgvdisdbdkbofwrc)"
prompt_if_empty "SUPABASE_PROD_REF"      "SUPABASE_PROD_REF (e.g., xwsgyxlvxntgpochonwe)"
prompt_if_empty "STAGING_DB_PASSWORD"    "STAGING_DB_PASSWORD" true
prompt_if_empty "PRODUCTION_DB_PASSWORD" "PRODUCTION_DB_PASSWORD" true
# Optional
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  read -r -p "   (Optional) SUPABASE_ACCESS_TOKEN for Edge Functions deploy (press Enter to skip): " tok || true
  [ -n "${tok:-}" ] && export SUPABASE_ACCESS_TOKEN="$tok"
fi
say ""

# ---------- Interactive choices (skip if flags provided) ----------
choose=false
$DRY_RUN || choose=true
$ALLOW_DESTRUCTIVE && choose=false || true
$AUTOSTASH || $DISCARD_LOCAL || choose=true

if [ "$choose" = true ]; then
  say "⚙️  Choose what to do:"
  say "   1) Dry run (preview SQL only)"
  say "   2) Apply additive changes (default)"
  read -r -p "   Select [1/2]: " choice
  case "${choice:-2}" in
    1) DRY_RUN=true ;;
    *) DRY_RUN=false ;;
  esac

  if [ "$DRY_RUN" = false ]; then
    say ""
    say "🛡️  Destructive changes (drops/renames)?"
    say "   N) No — additive only (SAFE DEFAULT)"
    say "   Y) Yes — include drops/renames (use only for contract phase)"
    read -r -p "   Select [Y/N]: " destr
    case "${destr:-N}" in
      Y|y) ALLOW_DESTRUCTIVE=true ;;
      *)   ALLOW_DESTRUCTIVE=false ;;
    esac
  fi

  say ""
  say "📦 Code deploy step needs a clean working tree."
  say "   A) Autostash local edits before deploy (recommended)"
  say "   D) Discard local edits (git reset --hard && git clean -fd)"
  say "   S) Skip automatic handling (abort if dirty)"
  read -r -p "   Select [A/D/S]: " dirt
  case "${dirt:-A}" in
    D|d) DISCARD_LOCAL=true; AUTOSTASH=false ;;
    S|s) DISCARD_LOCAL=false; AUTOSTASH=false ;;
    *)   AUTOSTASH=true; DISCARD_LOCAL=false ;;
  esac
  say ""
fi

# ---------- Show plan and confirm ----------
say "📝 Plan:"
say "   Mode:            $( [ "$DRY_RUN" = true ] && echo 'Dry run (no DB changes)' || echo 'Apply changes' )"
say "   Destructive:     $( [ "$ALLOW_DESTRUCTIVE" = true ] && echo 'ALLOWED (drops/renames enabled)' || echo 'Not allowed (additive only)' )"
say "   Git behavior:    $( [ "$AUTOSTASH" = true ] && echo 'Autostash' || ([ "$DISCARD_LOCAL" = true ] && echo 'Discard local' || echo 'Abort if dirty') )"
say "   Staging project: ${SUPABASE_STAGING_REF}"
say "   Prod project:    ${SUPABASE_PROD_REF}"
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && say "   Edge Functions:  Will deploy (token present)" || say "   Edge Functions:  Skipped (no token)"
read -r -p "Proceed? [y/N]: " go
[[ "${go:-N}" =~ ^[Yy]$ ]] || fail "Aborted."

[ "$DEBUG" = true ] && set -x

# ---------- Paths ----------
TS="$(date +%Y%m%d_%H%M%S)"
WORKDIR_REL="backups/${TS}_sync"
mkdir -p "$WORKDIR_REL"
WORKDIR="$(cd "$WORKDIR_REL" && pwd -P)"
PGPASS_LOCAL="${WORKDIR}/pgpass"

# ---------- DSNs (POOLER IPv4) — psql/pg_dump keyword form; Docker reads password from pgpass ----------
STAGING_DSN_KW="host=aws-1-us-east-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_STAGING_REF} dbname=postgres sslmode=require"
PROD_DSN_KW="host=aws-0-us-west-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_PROD_REF} dbname=postgres sslmode=require"

info "Probing database connectivity…"
PGPASSWORD="$STAGING_DB_PASSWORD"    psql "$STAGING_DSN_KW" -c "select 1;" >/dev/null
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW"    -c "select 1;" >/dev/null
ok "DB connectivity OK."

# ---------- Safety backup ----------
info "Backing up PROD (FULL) → ${WORKDIR}/prod_full.sql"
PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U "postgres.${SUPABASE_PROD_REF}" -d postgres > "${WORKDIR}/prod_full.sql"
ok "Backup complete."

# ---------- pgpass for Docker (absolute path mount) ----------
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

info "Generating schema diff (prod → staging)…"
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
[ $DOCKER_STATUS -ne 0 ] && fail "migra (Docker) failed. Re-run with --debug and share the output."

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
  DB_CHANGED=false
else
  DB_CHANGED=true
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
info "Deploying code (${MAIN_BRANCH} → ${REALPROD_BRANCH})…"
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
    fail "Uncommitted changes detected. Re-run choosing Autostash/Discard, or commit/stash manually."
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
[ "${AUTOSTASH:-false}" = true ] && echo "ℹ️  Your local edits are stashed as: ${STASH_NAME} (restore with: git stash pop \"stash^{/${STASH_NAME}}\")"
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
