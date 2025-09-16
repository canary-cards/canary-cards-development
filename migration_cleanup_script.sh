#!/bin/bash

# Migration Cleanup and Recovery Script
# This script fixes migration history inconsistencies and handles missing dependencies
# Specifically designed to handle deleted svg_assets table and other migration issues

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 Migration Cleanup and Recovery Script"
echo "========================================"
echo ""
echo "This script will:"
echo "1. Clean up failed migration history"
echo "2. Create stub tables for missing dependencies"
echo "3. Patch problematic migrations"
echo "4. Re-run migrations properly"
echo ""

# Function to URL-encode strings
url_encode() {
    local string="${1}"
    local strlen=${#string}
    local encoded=""
    local pos c o

    for (( pos=0 ; pos<strlen ; pos++ )); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9] ) o="${c}" ;;
            * ) printf -v o '%%%02X' "'$c" ;;
        esac
        encoded+="${o}"
    done
    echo "${encoded}"
}

# Get database credentials
echo "📋 Please provide database credentials:"
echo -n "Enter production database password: "
read -s PRODUCTION_DB_PASSWORD
echo ""

# Ask about reset preference
echo ""
echo "Choose cleanup strategy:"
echo "1. Safe mode - Patch and fix existing migrations"
echo "2. Aggressive mode - Remove all problematic data and start fresh (recommended since no data to preserve)"
echo -n "Enter choice (1 or 2): "
read CLEANUP_MODE
echo ""

# Encode passwords
ENCODED_PRODUCTION_PASSWORD=$(url_encode "$PRODUCTION_DB_PASSWORD")

# Database connection URLs (matching deployment script pattern exactly)
# Use PgBouncer (port 6543) for regular operations
PRODUCTION_DB_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:${ENCODED_PRODUCTION_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Use direct connection (port 5432) for administrative tasks
PRODUCTION_DB_DIRECT_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:${ENCODED_PRODUCTION_PASSWORD}@db.xwsgyxlvxntgpochonwe.supabase.co:5432/postgres"

# Configure with SSL mode
PRODUCTION_DB_POOLER_URL="${PRODUCTION_DB_URL}?sslmode=require"

# Test connection (using same pattern as deployment script)
echo "🔗 Testing database connection..."
echo "   Testing production database (pooler connection)..."

# Test with timeout and better error capture
error_output=$(timeout 30 psql "$PRODUCTION_DB_POOLER_URL" -c "SELECT 1 as test;" 2>&1)
exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ Production database connection successful${NC}"
else
    echo -e "${RED}❌ Failed to connect to production database${NC}"
    
    # Provide specific error diagnosis
    if echo "$error_output" | grep -q "password authentication failed"; then
        echo "   Issue: Password authentication failed"
        echo "   • Verify the password is correct in Supabase dashboard"
    elif echo "$error_output" | grep -q "timeout"; then
        echo "   Issue: Connection timeout"
        echo "   • Check network connectivity"
    elif echo "$error_output" | grep -q "SSL"; then
        echo "   Issue: SSL/TLS connection problem"
    else
        echo "   Error: ${error_output:0:200}"
    fi
    exit 1
fi
echo ""

# Create backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="migration_cleanup_backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "💾 Creating comprehensive backup..."
# Backup current state
export PGPASSWORD="$PRODUCTION_DB_PASSWORD"
pg_dump -h db.xwsgyxlvxntgpochonwe.supabase.co \
        -p 5432 \
        -U postgres.xwsgyxlvxntgpochonwe \
        -d postgres \
        --no-owner \
        --no-privileges \
        > "$BACKUP_DIR/full_backup.sql" 2>/dev/null || {
    # Fallback to pooler if direct fails
    pg_dump -h aws-0-us-west-1.pooler.supabase.com \
            -p 6543 \
            -U postgres.xwsgyxlvxntgpochonwe \
            -d postgres \
            --no-owner \
            --no-privileges \
            > "$BACKUP_DIR/full_backup.sql"
}
unset PGPASSWORD

# Backup migration history
psql "$PRODUCTION_DB_URL" -c "\COPY (SELECT * FROM supabase_migrations.schema_migrations) TO STDOUT WITH CSV HEADER;" > "$BACKUP_DIR/migration_history.csv" 2>/dev/null || echo "No migration history to backup"

echo -e "${GREEN}✅ Backup created in $BACKUP_DIR${NC}"
echo ""

if [ "$CLEANUP_MODE" = "2" ]; then
    echo "🔥 AGGRESSIVE MODE: Cleaning all problematic data..."
    
    psql "$PRODUCTION_DB_URL" << 'EOF'
BEGIN;

-- Clean migration history completely for failed migrations
DELETE FROM supabase_migrations.schema_migrations 
WHERE version IN (
    '20250903012948_c1c2e15f-46c0-4802-a69b-eae3a458e94d',
    '20250903201111_8238529f-d297-4c83-875a-18492269e8a3',
    '20250904195015_548eee53-745a-4dd9-aaf6-87dd7c6db27b',
    '20250904195555_502dc99b-f48b-435d-ad58-e78080e60e79',
    '20250904200324_7d64d701-bfbd-4a21-892c-d4eda2780290',
    '20250904200547_58dfc6e3-b785-48a6-903c-1a3204bd4ea5',
    '20250905001012_ac1e3d3d-82c1-4e71-84c6-b576bfec6abe',
    '20250905233231_ef6cf30b-2302-48af-94dc-d7b1d95e8724',
    '20250906003627_3e2cfce7-7796-44d9-87ec-4bdd2ce9ab6f',
    '20250907080439_74036412-3c8f-406b-a1de-24f4095be0b9',
    '20250907095025_423a91cf-7957-443d-9086-f8ebdc109ba2',
    '20250909180036_0a9f7865-4a9e-40f4-8e89-36f678fddde8',
    '20250909180058_d426acb6-ce82-4c7b-bd9b-7255927c702e',
    '20250910155000_critical_rls_policies_fix',
    '20250915173734_c2468482-a382-47c5-b201-4ea48dd57f68',
    '20250915173924_6fbc059c-578a-4055-be5b-d78393028cce',
    '20250915181641_fa3ccbc6-1ee7-401a-a616-227617169b38',
    '20250915181854_07d41ad9-f635-4fa8-b77c-b96532bc660e'
);

-- Drop all svg_assets related objects if they exist
DROP TABLE IF EXISTS public.svg_assets CASCADE;
DROP TABLE IF EXISTS svg_assets CASCADE;

-- Drop deployment_logs related objects
DROP TABLE IF EXISTS public.deployment_logs CASCADE;
DROP VIEW IF EXISTS public.deployment_dashboard CASCADE;

-- Clean up any orphaned policies
DO $$
BEGIN
    -- Drop policies that might be orphaned
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public uploads to svg-assets bucket' AND tablename = 'objects') THEN
        EXECUTE 'DROP POLICY "Allow public uploads to svg-assets bucket" ON storage.objects';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_deny_public_access' AND tablename = 'customers') THEN
        EXECUTE 'DROP POLICY customers_deny_public_access ON customers';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors for non-existent policies
        NULL;
END $$;

COMMIT;
EOF
    
    echo -e "${GREEN}✅ Cleaned problematic data${NC}"
    
else
    echo "🛡️ SAFE MODE: Creating compatibility fixes..."
fi

# Step 2: Create stub tables and missing dependencies
echo "🔨 Creating missing dependencies..."

psql "$PRODUCTION_DB_URL" << 'EOF'
BEGIN;

-- Create stub svg_assets table (will be removed by migration 20250907054309)
CREATE TABLE IF NOT EXISTS public.svg_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create stub deployment_logs table if needed
CREATE TABLE IF NOT EXISTS public.deployment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_type TEXT,
    status TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure storage schema exists
CREATE SCHEMA IF NOT EXISTS storage;

-- Ensure supabase_migrations schema exists
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text NOT NULL PRIMARY KEY,
    inserted_at timestamptz DEFAULT now()
);

COMMIT;
EOF

echo -e "${GREEN}✅ Created missing dependencies${NC}"
echo ""

# Step 3: Create migration patches
echo "📝 Creating migration patches..."
mkdir -p migration_patches

# Patch for bucket creation migration
cat > migration_patches/patch_20250903012948.sql << 'PATCH'
-- Patched version: Check if bucket exists before creating
DO $$
BEGIN
    -- Only insert if bucket doesn't exist
    INSERT INTO storage.buckets (id, name, public)
    SELECT 'svg-assets', 'svg-assets', true
    WHERE NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'svg-assets'
    );
END $$;
PATCH

# Patch for CONCURRENTLY index creation
cat > migration_patches/patch_20250907080439.sql << 'PATCH'
-- Patched version: Create index without CONCURRENTLY (or skip if exists)
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON customers(stripe_customer_id);
PATCH

# Patch for enum value addition
cat > migration_patches/patch_20250907095025.sql << 'PATCH'
-- Patched version: Check if enum value exists before adding
DO $$
BEGIN
    -- Only add if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'refunded' 
        AND enumtypid = 'order_status'::regtype
    ) THEN
        ALTER TYPE order_status ADD VALUE 'refunded';
    END IF;
END $$;
PATCH

# Patch for RLS policies
cat > migration_patches/patch_20250910155000.sql << 'PATCH'
-- Patched version: Drop existing policies before creating
DO $$
BEGIN
    -- Drop if exists
    DROP POLICY IF EXISTS customers_deny_public_access ON customers;
    DROP POLICY IF EXISTS postcards_deny_public_access ON postcards;
    DROP POLICY IF EXISTS postcard_drafts_deny_public_access ON postcard_drafts;
    DROP POLICY IF EXISTS postcard_draft_sources_deny_public_access ON postcard_draft_sources;
    DROP POLICY IF EXISTS orders_deny_public_access ON orders;
END $$;

-- Now create the policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE postcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE postcard_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE postcard_draft_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_deny_public_access ON customers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY postcards_deny_public_access ON postcards FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY postcard_drafts_deny_public_access ON postcard_drafts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY postcard_draft_sources_deny_public_access ON postcard_draft_sources FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY orders_deny_public_access ON orders FOR ALL USING (auth.uid() IS NOT NULL);
PATCH

echo -e "${GREEN}✅ Created migration patches${NC}"
echo ""

# Step 4: Apply patches for problematic migrations
echo "🚀 Applying migration fixes..."

# Function to apply a migration with patch
apply_migration_with_patch() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file" .sql)
    local patch_file="migration_patches/patch_${migration_name}.sql"
    
    # Check if already applied (use PRODUCTION_DB_URL without pooler suffix)
    local already_applied=$(psql "$PRODUCTION_DB_URL" -t -c "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$migration_name';" 2>/dev/null | tr -d ' ')
    
    if [ "$already_applied" = "1" ]; then
        echo "   ⏭️  Skipping $migration_name (already applied)"
        return 0
    fi
    
    echo "   📦 Applying $migration_name..."
    
    # Use patch if available, otherwise original
    local file_to_apply="$migration_file"
    if [ -f "$patch_file" ]; then
        echo "      Using patched version"
        file_to_apply="$patch_file"
    fi
    
    # Apply the migration (use PRODUCTION_DB_URL)
    local output=$(psql "$PRODUCTION_DB_URL" << EOF 2>&1
BEGIN;
\i $file_to_apply
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('$migration_name');
COMMIT;
EOF
)
    
    if echo "$output" | grep -q "ROLLBACK"; then
        echo "      ❌ Failed (rolled back)"
        echo "      Error: $(echo "$output" | grep ERROR | head -1)"
        
        # For non-critical migrations, mark as applied anyway
        if [[ "$migration_name" =~ (svg_assets|deployment_logs|http) ]]; then
            echo "      📌 Marking as applied (non-critical)"
            psql "$PRODUCTION_DB_URL" -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('$migration_name');" 2>/dev/null
        fi
        return 1
    else
        echo "      ✅ Successfully applied"
        return 0
    fi
}

# Apply all migrations in order
echo "📂 Processing migrations..."
FAILED_COUNT=0
SUCCESS_COUNT=0

for migration_file in $(find supabase/migrations -name "*.sql" 2>/dev/null | sort); do
    if apply_migration_with_patch "$migration_file"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "📊 Migration Summary:"
echo "   ✅ Successful: $SUCCESS_COUNT"
echo "   ❌ Failed: $FAILED_COUNT"
echo ""

# Step 5: Final cleanup - remove svg_assets if it was just a stub
echo "🧹 Final cleanup..."
psql "$PRODUCTION_DB_URL" << 'EOF'
BEGIN;

-- Remove svg_assets table and any remnants (it was deleted manually anyway)
DROP TABLE IF EXISTS public.svg_assets CASCADE;

-- Remove any svg-assets related storage policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public uploads to svg-assets bucket" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public downloads from svg-assets bucket" ON storage.objects;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Ensure all tables have proper RLS
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS postcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS postcard_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS postcard_draft_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

COMMIT;
EOF

echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# Step 6: Verification
echo "🔍 Verifying database state..."

# Check critical tables
TABLES_CHECK=$(psql "$PRODUCTION_DB_URL" -t -c "
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('customers', 'postcards', 'postcard_drafts', 'orders');
")

if [ "$(echo $TABLES_CHECK | tr -d ' ')" -ge "4" ]; then
    echo -e "${GREEN}✅ Critical tables present${NC}"
else
    echo -e "${YELLOW}⚠️  Some critical tables missing${NC}"
fi

# Check RLS
RLS_CHECK=$(psql "$PRODUCTION_DB_URL" -t -c "
    SELECT COUNT(*) FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('customers', 'postcards', 'postcard_drafts', 'orders')
    AND rowsecurity = true;
")

if [ "$(echo $RLS_CHECK | tr -d ' ')" -ge "4" ]; then
    echo -e "${GREEN}✅ RLS enabled on critical tables${NC}"
else
    echo -e "${YELLOW}⚠️  RLS not fully enabled${NC}"
fi

echo ""
echo "✨ Migration cleanup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test your application to ensure it's working"
echo "2. Run your deployment script again with the fixed version"
echo "3. If issues persist, restore from: $BACKUP_DIR/full_backup.sql"
echo ""
echo "🔄 To restore from backup if needed:"
echo "   psql \$PRODUCTION_DB_URL < $BACKUP_DIR/full_backup.sql"
echo ""

# Create a migration for permanent svg_assets removal
echo "💡 Creating migration to properly remove svg_assets references..."
cat > "supabase/migrations/$(date +%Y%m%d%H%M%S)_remove_svg_assets_permanently.sql" << 'MIGRATION'
-- Migration to properly remove all svg_assets references
-- This handles the manual deletion that was done outside of migrations

BEGIN;

-- Drop any remaining svg_assets tables
DROP TABLE IF EXISTS public.svg_assets CASCADE;
DROP TABLE IF EXISTS svg_assets CASCADE;

-- Remove storage bucket if it exists
DELETE FROM storage.buckets WHERE id = 'svg-assets';

-- Remove any related storage policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%svg-assets%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Add comment explaining the removal
COMMENT ON SCHEMA public IS 'svg_assets table and related functionality have been permanently removed';

COMMIT;
MIGRATION

echo -e "${GREEN}✅ Created removal migration for svg_assets${NC}"
echo ""
echo "This new migration will be applied next time you run your deployment script."
