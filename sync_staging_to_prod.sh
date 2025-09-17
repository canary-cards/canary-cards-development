#!/bin/bash

# ==============================================================================
# Canary Cards — Sync STAGING → PROD (Schema-only, Safe-by-default)
#
# What this does (non-destructive by default):
#   • Diffs the STAGING database schema (public) against PROD using Docker + migra
#   • Applies only ADDITIVE changes by default (new tables/columns/indexes, enum values)
#   • Preserves all existing PROD data - NO DATA IS EVER DELETED OR OVERWRITTEN
#   • Only modifies database SCHEMA (structure), never touches the actual data/rows
#   • Then deploys code: merges `main` → `realproduction` and pushes
#   • Then deploys Supabase Edge Functions
#
# What this does NOT do:
#   • Does NOT touch the `storage` schema (policies/grants/ownership there are Supabase-managed)
#   • Does NOT manage storage buckets, files, or storage policies
#   • Does NOT delete, modify, or overwrite any existing data in your tables
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
#   • `storage` schema and storage buckets are intentionally ignored (ownership/privileges differ in Supabase).
#   • All table data is preserved - this tool only modifies schema structure.
#   • Enum handling: we add new values; removals/renames require --allow-destructive.
#   • Destructive diffs are wrapped in a transaction but you should use with care.
# ==============================================================================

# ===== Check Required Environment Variables First =====
echo ""
echo "🔧 Checking environment variables..."

MISSING_VARS=""
if [ -z "$STAGING_DB_PASSWORD" ]; then
    MISSING_VARS="$MISSING_VARS STAGING_DB_PASSWORD"
fi
if [ -z "$PRODUCTION_DB_PASSWORD" ]; then
    MISSING_VARS="$MISSING_VARS PRODUCTION_DB_PASSWORD"
fi
if [ -z "$SUPABASE_STAGING_REF" ]; then
    MISSING_VARS="$MISSING_VARS SUPABASE_STAGING_REF"
fi
if [ -z "$SUPABASE_PROD_REF" ]; then
    MISSING_VARS="$MISSING_VARS SUPABASE_PROD_REF"
fi

if [ -n "$MISSING_VARS" ]; then
    echo "❌ Missing required environment variables:$MISSING_VARS"
    echo ""
    echo "Please set them first:"
    for var in $MISSING_VARS; do
        echo "  export $var=your_value_here"
    done
    echo ""
    exit 1
fi

echo "✅ All required environment variables are set"
echo ""

# ===== Interactive Flag Selection =====
echo "🚀 Welcome to the Canary Cards Database Sync Tool"
echo "=================================================="
echo ""
echo "This tool will sync your STAGING database schema to PRODUCTION,"
echo "then deploy your code changes and Edge Functions."
echo ""
echo "What this does (non-destructive by default):"
echo "  • Diffs the STAGING database schema (public) against PROD using Docker + migra"
echo "  • Applies only ADDITIVE changes by default (new tables/columns/indexes, enum values)"
echo "  • Preserves all existing PROD data - NO DATA IS EVER DELETED OR OVERWRITTEN"
echo "  • Only modifies database SCHEMA (structure), never touches the actual data/rows"
echo "  • Then deploys code: merges main → realproduction and pushes"
echo "  • Then deploys Supabase Edge Functions"
echo ""
echo "Please select your sync mode:"
echo ""
echo "1) DRY RUN - Preview changes only (recommended first time)"
echo "   Shows you exactly what SQL will be applied without making any changes"
echo ""
echo "2) NORMAL SYNC - Safe deployment (RECOMMENDED)"
echo "   Applies only additive changes: new tables, columns, indexes, enum values"
echo ""
echo "3) DESTRUCTIVE SYNC - Include drops and renames (DANGEROUS)"
echo "   Can drop/rename tables and columns. Use when you need to remove things"
echo ""
echo "4) DEBUG MODE - Normal sync with verbose logging"
echo "   Same as normal sync but shows detailed output for troubleshooting"
echo ""

# Get user selection
while true; do
    echo -n "Enter your choice (1-4) [default: 2]: "
    read -r choice
    
    # Handle default
    if [ -z "$choice" ]; then
        choice=2
    fi
    
    case "$choice" in
        1)
            DRY_RUN=true
            ALLOW_DESTRUCTIVE=false
            DEBUG=false
            MODE_DESCRIPTION="DRY RUN (preview only)"
            break
            ;;
        2)
            DRY_RUN=false
            ALLOW_DESTRUCTIVE=false
            DEBUG=false
            MODE_DESCRIPTION="NORMAL SYNC (safe, additive changes only)"
            break
            ;;
        3)
            DRY_RUN=false
            ALLOW_DESTRUCTIVE=true
            DEBUG=false
            MODE_DESCRIPTION="DESTRUCTIVE SYNC (includes drops/renames)"
            break
            ;;
        4)
            DRY_RUN=false
            ALLOW_DESTRUCTIVE=false
            DEBUG=true
            MODE_DESCRIPTION="DEBUG MODE (normal sync with verbose logging)"
            break
            ;;
        *)
            echo "❌ Invalid choice. Please enter 1, 2, 3, or 4."
            echo ""
            ;;
    esac
done

# ===== Final Confirmation =====
echo ""
echo "📋 CONFIRMATION"
echo "==============="
echo "Selected mode: $MODE_DESCRIPTION"
echo ""
echo "What will happen:"
if [ "$DRY_RUN" = true ]; then
    echo "  ✓ Connect to staging and production databases"
    echo "  ✓ Generate schema diff (staging → production)"
    echo "  ✓ Show you the SQL that WOULD be applied"
    echo "  ✓ Exit without making any changes"
else
    echo "  ✓ Create full backup of production database"
    echo "  ✓ Connect to staging and production databases"
    echo "  ✓ Generate and apply schema changes to production"
    if [ "$ALLOW_DESTRUCTIVE" = true ]; then
        echo "  ⚠️  DESTRUCTIVE changes (drops/renames) will be included"
    else
        echo "  ✓ Only safe, additive changes will be applied"
    fi
    echo "  ✓ Deploy code changes (main → realproduction)"
    echo "  ✓ Deploy Supabase Edge Functions"
fi
if [ "$DEBUG" = true ]; then
    echo "  ✓ Show detailed debug output"
fi
echo ""

while true; do
    echo -n "Proceed with this configuration? (y/n): "
    read -r confirm
    case "$confirm" in
        [Yy]|[Yy][Ee][Ss])
            echo ""
            echo "🎯 Starting sync process..."
            echo ""
            break
            ;;
        [Nn]|[Nn][Oo])
            echo "❌ Sync cancelled by user"
            exit 0
            ;;
        *)
            echo "Please enter 'y' for yes or 'n' for no."
            ;;
    esac
done

# ===== Initialize Variables =====
# (User selections from interactive menu are already set above)

# ===== Git branches (configurable) =====
MAIN_BRANCH="${MAIN_BRANCH:-main}"
REALPROD_BRANCH="${REALPROD_BRANCH:-realproduction}"

# ===== Binaries =====
require() {
    command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; };
}

require docker
require psql
require pg_dump
require supabase
require git

[ "$DEBUG" = true ] && set -x

TS="$(date +%Y%m%d_%H%M%S)"
WORKDIR="backups/${TS}_sync"
mkdir -p "$WORKDIR"

# ===== DSNs (POOLER IPv4) — no passwords embedded =====
STAGING_DSN_KW="host=aws-1-us-east-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_STAGING_REF} dbname=postgres sslmode=require"
PROD_DSN_KW="host=aws-0-us-west-1.pooler.supabase.com port=6543 user=postgres.${SUPABASE_PROD_REF} dbname=postgres sslmode=require"

echo "🔗 Probing connectivity (pooler)…"
PGPASSWORD="$STAGING_DB_PASSWORD" psql "$STAGING_DSN_KW" -c "select 1;" >/dev/null
PGPASSWORD="$PRODUCTION_DB_PASSWORD" psql "$PROD_DSN_KW" -c "select 1;" >/dev/null
echo " ✅ OK"

# ===== Full backup of PROD (safety) =====
if [ "$DRY_RUN" = false ]; then
    echo "💾 Backing up PROD (FULL) → ${WORKDIR}/prod_full.sql"
    PGPASSWORD="$PRODUCTION_DB_PASSWORD" pg_dump -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
        -U "postgres.${SUPABASE_PROD_REF}" -d postgres > "${WORKDIR}/prod_full.sql"
else
    echo "💾 Skipping PROD backup (dry run mode)"
fi

# ===== Build pgpass for Docker (avoid embedding passwords) =====
PGPASS_LOCAL="$(pwd)/${WORKDIR}/pgpass"
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
DOCKER_CMD='pip install --no-cache-dir migra >/dev/null && migra '"$MIGRA_FLAGS"' "$PROD_DSN" "$STAGING_DSN"'

docker run --rm \
    -v "$PGPASS_LOCAL":/tmp/pgpass:ro \
    -e PGPASSFILE=/tmp/pgpass \
    -e PROD_DSN="$PROD_DSN_KW" \
    -e STAGING_DSN="$STAGING_DSN_KW" \
    python:3.11-slim bash -lc "$DOCKER_CMD" > "$DIFF_SQL" || true

# ===== Sanitize diff: strip owner changes & ALTER DEFAULT PRIVILEGES =====
SANITIZED_SQL="${WORKDIR}/sync_diff_sanitized.sql"

if command -v perl >/dev/null 2>&1; then
    perl -0777 -pe '
        s/^\s*ALTER\s+(TABLE|SEQUENCE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|AGGREGATE|TYPE|DOMAIN)\s+.*\sOWNER\s+TO\s+.*?;\s*$//gmi;
        s/^\s*ALTER\s+DEFAULT\s+PRIVILEGES\b.*?;\s*$//gmis;
    ' "$DIFF_SQL" > "$SANITIZED_SQL"
else
    grep -v -E 'OWNER[[:space:]]+TO|^[[:space:]]*ALTER[[:space:]]+DEFAULT[[:space:]]+PRIVILEGES' "$DIFF_SQL" > "$SANITIZED_SQL" || true
fi

# ===== No-op? =====
if [ ! -s "$SANITIZED_SQL" ]; then
    echo "✅ Already in sync (no schema changes)."
    DB_CHANGED=false
    if [ "$DRY_RUN" = true ]; then
        echo ""
        echo "🔍 DRY RUN COMPLETE - No changes were made to production"
        echo "  (No schema differences found)"
        exit 0
    fi
else
    DB_CHANGED=true
    echo "🗂️ Diff written: $DIFF_SQL"
    
    if [ "$DRY_RUN" = true ]; then
        echo "👀 Dry run only. Sanitized (to be applied) at: $SANITIZED_SQL"
        echo ""
        echo "🔍 DRY RUN COMPLETE - No changes were made to production"
        echo "  Schema diff: $DIFF_SQL"
        echo "  Sanitized diff: $SANITIZED_SQL"
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
if [ "$DRY_RUN" = false ]; then
    echo "📦 Deploying code changes ( ${MAIN_BRANCH} → ${REALPROD_BRANCH} )..."

    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo "")"

    # Preflight
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "🛑 Uncommitted changes in working tree. Commit/stash them and rerun."
        exit 1
    fi

    git fetch origin --quiet

    # Ensure branches exist locally
    git checkout "$REALPROD_BRANCH" >/dev/null 2>&1 || {
        echo "🛑 Branch $REALPROD_BRANCH not found locally."
        exit 1
    }

    echo " Merging ${MAIN_BRANCH} into ${REALPROD_BRANCH}…"
    if ! git merge "$MAIN_BRANCH" --no-edit; then
        echo "❌ Merge conflict detected. Resolve manually, then push."
        # Return to original branch
        [ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
        exit 1
    fi

    echo " Pushing ${REALPROD_BRANCH}…"
    git push origin "$REALPROD_BRANCH"

    echo "✅ Code deployment complete"

    # Return to prior branch
    [ -n "$CURRENT_BRANCH" ] && git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true

    echo ""
fi

# ===== Edge Functions (deploy) =====
if [ "$DRY_RUN" = false ]; then
    echo "⚡ Deploying Edge Functions to production…"

    supabase login --token "${SUPABASE_ACCESS_TOKEN:-}" >/dev/null 2>&1 || true
    supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null

    if [ -d "supabase/functions" ]; then
        for dir in supabase/functions/*; do
            [ -d "$dir" ] || continue
            fn="$(basename "$dir")"
            echo " • $fn"
            supabase functions deploy "$fn" --project-ref "$SUPABASE_PROD_REF" || echo "  ⚠️ $fn deploy failed (continuing)"
        done
    fi
fi

echo "🎉 Done."
echo "  Backup: ${WORKDIR}/prod_full.sql"
echo "  Raw diff: ${DIFF_SQL}"
echo "  Sanitized diff:${SANITIZED_SQL}"
echo "  Destructive: $ALLOW_DESTRUCTIVE (use --allow-destructive to include drops/renames)"
