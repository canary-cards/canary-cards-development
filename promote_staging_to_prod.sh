#!/usr/bin/env bash
set -euo pipefail

# ---------- Config ----------
MIGRATION_NAME="normalize_from_staging_$(date +%Y%m%d_%H%M%S)"
SCHEMAS=("public" "storage")   # add more if you use others (e.g., "auth", "graphql_public")

# Optional: set to "true" to skip confirmation prompts
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"

# Optional: deploy code after DB promotion (requires Vercel env vars)
DEPLOY_CODE="${DEPLOY_CODE:-false}"

# ---------- Safety checks ----------
require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. Install it and re-run."; exit 1; }; }
require supabase

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_STAGING_REF:?SUPABASE_STAGING_REF is required}"
: "${SUPABASE_PROD_REF:?SUPABASE_PROD_REF is required}"

# ---------- Helper ----------
confirm() {
  if [ "$NON_INTERACTIVE" = "true" ]; then return 0; fi
  read -r -p "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

echo "🔐 Logging into Supabase CLI..."
supabase login --token "$SUPABASE_ACCESS_TOKEN" >/dev/null

# ---------- Step 1: Generate a fresh migration from STAGING truth ----------
echo "🔗 Linking to STAGING ($SUPABASE_STAGING_REF)..."
supabase link --project-ref "$SUPABASE_STAGING_REF" >/dev/null

echo "🧮 Creating migration from STAGING truth → local migrations/"
# Prefer a true diff from remote (linked) to the local state using migra
# This writes a new file: supabase/migrations/<timestamp>_${MIGRATION_NAME}.sql
DIFF_ARGS=(db diff -f "$MIGRATION_NAME" --linked --use-migra)
for s in "${SCHEMAS[@]}"; do DIFF_ARGS+=(--schema "$s"); done
supabase "${DIFF_ARGS[@]}"

# Edge case: if nothing changed, db diff may create an empty/no-op migration.
# We'll detect if the last file is effectively empty and skip later.
LAST_FILE="$(ls -1t supabase/migrations/*_"$MIGRATION_NAME".sql | head -n1 || true)"
if [ -z "${LAST_FILE}" ]; then
  echo "⚠️  No migration file produced. Your local migrations may already match STAGING."
else
  echo "📄 Generated: $LAST_FILE"
fi

# ---------- Optional: Capture STORAGE policies explicitly ----------
# (Sometimes policies live in 'storage' and don’t always get diffed as expected)
echo "📦 Ensuring storage changes are captured (best-effort pull)..."
supabase db pull --schema storage || true

# ---------- Step 2: (Optional) Backups ----------
if [ -n "${PROD_PGURL:-}" ]; then
  echo "💾 Dumping PROD to backup: backups/prod_$(date +%Y%m%d_%H%M%S).sql"
  mkdir -p backups
  supabase db dump -f "backups/prod_$(date +%Y%m%d_%H%M%S).sql" --db-url "$PROD_PGURL" || {
    echo "⚠️  PROD dump failed (continuing). Provide PROD_PGURL if you want this backup."
  }
fi
if [ -n "${STAGING_PGURL:-}" ]; then
  echo "💾 Dumping STAGING to backup: backups/staging_$(date +%Y%m%d_%H%M%S).sql"
  mkdir -p backups
  supabase db dump -f "backups/staging_$(date +%Y%m%d_%H%M%S).sql" --db-url "$STAGING_PGURL" || {
    echo "⚠️  STAGING dump failed (continuing). Provide STAGING_PGURL if you want this backup."
  }
fi

# ---------- Step 3: Dry-run against PROD ----------
echo "🔗 Linking to PROD ($SUPABASE_PROD_REF)..."
supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null

echo "🧪 Dry-run: applying all local migrations → PROD"
if ! supabase db push --dry-run; then
  echo "❌ Dry-run indicates errors. Fix them (or re-run after updating STAGING), then try again."
  exit 1
fi

if ! confirm "Proceed to APPLY migrations to PROD?"; then
  echo "🛑 Aborted before applying to PROD."
  exit 0
fi

# ---------- Step 4: Apply to PROD ----------
echo "🚀 Applying migrations to PROD..."
supabase db push

echo "✅ PROD schema is now aligned with STAGING truth."

# ---------- Step 5: Optional code deploy via Vercel ----------
if [ "$DEPLOY_CODE" = "true" ]; then
  : "${VERCEL_TOKEN:?VERCEL_TOKEN is required for code deployment}"
  : "${VERCEL_PROJECT:?VERCEL_PROJECT is required for code deployment}"

  require vercel
  echo "🧭 Vercel deploy (prod)..."
  vercel pull --yes --environment=production --token "$VERCEL_TOKEN" --project "$VERCEL_PROJECT"
  vercel deploy --prod --token "$VERCEL_TOKEN" --project "$VERCEL_PROJECT"
  echo "✅ Code deployed to Vercel production."
else
  echo "ℹ️  Skipping code deploy. Set DEPLOY_CODE=true and Vercel envs to enable."
fi

echo "🎉 Done."
