#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?}"
: "${SUPABASE_STAGING_REF:?}"
: "${SUPABASE_PROD_REF:?}"

confirm() { read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy]$ ]]; }

echo "🔐 Login"; supabase login --token "$SUPABASE_ACCESS_TOKEN" >/dev/null

echo "🔗 Link STAGING ($SUPABASE_STAGING_REF)"; supabase link --project-ref "$SUPABASE_STAGING_REF" >/dev/null

echo "🗃️  Archive old migrations"; mkdir -p supabase/migrations_archive
shopt -s nullglob
for f in supabase/migrations/*.sql; do git mv "$f" supabase/migrations_archive/ || mv "$f" supabase/migrations_archive/; done

echo "📸 Pull baseline from STAGING"
supabase db pull --schema public
supabase db pull --schema storage || true
supabase db pull --schema auth || true

echo "🔗 Link PROD ($SUPABASE_PROD_REF)"; supabase link --project-ref "$SUPABASE_PROD_REF" >/dev/null

echo "🧪 Dry-run to PROD"; supabase db push --dry-run

confirm "Apply baseline to PROD now?" || { echo "Aborted."; exit 0; }

echo "🚀 Apply baseline"; supabase db push

echo "✅ Done. Commit the new baseline migration and the archive."
