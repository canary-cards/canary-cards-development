#!/usr/bin/env bash
# Sync Prod to match Staging exactly (schema/RLS/enums) + deploy Edge Functions + secrets
# Requirements: supabase CLI, psql, pg_dump installed
# Env you must set (use pooler :6543 + sslmode=require):
#   export STAGING_PGURL='postgresql://postgres.pug...:<PW>@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'
#   export PROD_PGURL='postgresql://postgres.xws...:<PW>@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require'
# Optional (for functions & secrets):
#   export SUPABASE_ACCESS_TOKEN=...        # personal access token
#   export PROD_PROJECT_REF=xwsgyxlvxntgpochonwe
#   # If you keep prod secrets in a file:
#   # export FUNCTIONS_ENV_FILE="supabase/.env.production"

set -euo pipefail

# ---- checks ----
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
need supabase; need psql; need pg_dump
: "${STAGING_PGURL:?Set STAGING_PGURL}"; : "${PROD_PGURL:?Set PROD_PGURL}"

ART_DIR="sync_artifacts"
mkdir -p "$ART_DIR"

echo "① Dumping STAGING roles and schema (no data)..."
# Note: db dump excludes auth/storage by default; we explicitly include them.
supabase db dump --db-url "$STAGING_PGURL" -f "$ART_DIR/roles.sql" --role-only
supabase db dump --db-url "$STAGING_PGURL" -f "$ART_DIR/schema.sql" \
  --schema public,auth,storage,graphql_public,extensions 2>/dev/null || \
  supabase db dump --db-url "$STAGING_PGURL" -f "$ART_DIR/schema.sql" \
  --schema public,auth,storage  # fallback if some schemas don’t exist

# (Optional) bring over just Storage bucket rows so existing buckets work in Prod.
# This does NOT copy objects, just bucket metadata.
echo "   (optional) Exporting storage.buckets rows..."
pg_dump --data-only --inserts --table=storage.buckets "$STAGING_PGURL" > "$ART_DIR/storage_buckets.sql" || echo "   Skipping buckets export (table may not exist)."

echo "② Restoring to PROD in a single transaction..."
psql --single-transaction -v ON_ERROR_STOP=1 "$PROD_PGURL" \
  -f "$ART_DIR/roles.sql" \
  -f "$ART_DIR/schema.sql"

# If we exported bucket rows, apply them now (ignores if file empty)
if [ -s "$ART_DIR/storage_buckets.sql" ]; then
  echo "   Inserting storage.buckets rows to PROD..."
  psql -v ON_ERROR_STOP=1 "$PROD_PGURL" -f "$ART_DIR/storage_buckets.sql"
fi

echo "✅ PROD now matches STAGING schema/RLS/enums."

# ---- Edge Functions (optional but recommended) ----
if [[ -n "${PROD_PROJECT_REF:-}" ]]; then
  echo "③ Deploying Edge Functions to PROD project $PROD_PROJECT_REF ..."
  # You can deploy all functions at once and pass --project-ref to avoid 'link'
  supabase functions deploy --project-ref "$PROD_PROJECT_REF"
  echo "   Edge Functions deployed."
  # Secrets (either from a file or individual keys)
  if [[ -n "${FUNCTIONS_ENV_FILE:-}" && -f "$FUNCTIONS_ENV_FILE" ]]; then
    echo "④ Setting function secrets from $FUNCTIONS_ENV_FILE ..."
    supabase secrets set --project-ref "$PROD_PROJECT_REF" --env-file "$FUNCTIONS_ENV_FILE"
    echo "   Secrets set."
  else
    echo "④ (optional) Set function secrets with:"
    echo "   supabase secrets set --project-ref \"$PROD_PROJECT_REF\" --env-file supabase/.env.production"
  fi
else
  echo "ℹ️ Skipped Edge Functions/secrets (set PROD_PROJECT_REF to enable)."
fi

echo "🎉 Done."
