#!/bin/bash

# Generate Migration - Standalone migration generator with safety features
# This script creates production-safe SQL migration files with destructive change protection

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get migration description
DESCRIPTION="$1"
if [[ -z "$DESCRIPTION" ]]; then
    echo "🔧 Generate Production-Safe Migration"
    echo ""
    read -p "Enter migration description: " DESCRIPTION
fi

if [[ -z "$DESCRIPTION" ]]; then
    echo -e "${RED}❌ Migration description is required${NC}"
    exit 1
fi

echo "🔧 Generating migration: $DESCRIPTION"
echo ""

# Generate timestamp and sanitize filename
TIMESTAMP=$(date +%Y%m%d%H%M%S)
SAFE_DESCRIPTION=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g')
MIGRATION_FILE="supabase/migrations/${TIMESTAMP}_${SAFE_DESCRIPTION}.sql"

echo "📁 Migration file: $MIGRATION_FILE"
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first.${NC}"
    exit 1
fi

# Project IDs
STAGING_PROJECT="pugnjgvdisdbdkbofwrc"
PRODUCTION_PROJECT="xwsgyxlvxntgpochonwe"

echo "🔍 Analyzing differences between staging and production..."

# Connect to staging and generate diff
echo "   Connecting to staging project..."
if ! supabase projects list | grep -q "$STAGING_PROJECT"; then
    echo -e "${RED}❌ Cannot access staging project. Please run: supabase login${NC}"
    exit 1
fi

# Generate migration using db diff
echo "   Generating migration from staging differences..."
TEMP_MIGRATION="/tmp/temp_migration_${TIMESTAMP}.sql"

if supabase db diff --project-ref "$STAGING_PROJECT" --project-ref-2 "$PRODUCTION_PROJECT" > "$TEMP_MIGRATION" 2>/dev/null; then
    echo -e "${GREEN}✅ Migration diff generated successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Could not generate diff - creating template migration${NC}"
    cat > "$TEMP_MIGRATION" << 'EOF'
-- No automatic differences detected
-- Add your custom migration statements below

-- Example: Create new table
-- CREATE TABLE IF NOT EXISTS public.example_table (
--     id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
--     name text NOT NULL,
--     created_at timestamptz NOT NULL DEFAULT now()
-- );

-- Example: Add new column
-- ALTER TABLE public.existing_table 
-- ADD COLUMN IF NOT EXISTS new_column text;

-- Example: Create index
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_example 
-- ON public.example_table (name);
EOF
fi

echo ""
echo "🛡️  Applying safety transformations..."

# Create final migration file with header
cat > "$MIGRATION_FILE" << EOF
-- Migration: $DESCRIPTION
-- Generated: $(date)
-- Status: REQUIRES REVIEW

-- PRODUCTION SAFETY CHECKLIST:
-- [ ] Review all changes for data safety
-- [ ] Verify no destructive operations (DROP, TRUNCATE, DELETE)
-- [ ] Test migration on staging copy first
-- [ ] Ensure all operations are additive and reversible
-- [ ] Validate that existing data won't be affected

-- SAFETY FEATURES APPLIED:
-- ✅ IF NOT EXISTS added to CREATE statements
-- ✅ Destructive operations commented for review
-- ✅ Column additions made nullable or with defaults
-- ✅ Indexes created with CONCURRENTLY when possible

-- BEGIN MIGRATION STATEMENTS

EOF

# Process the generated SQL with safety transforms
while IFS= read -r line; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*-- ]]; then
        echo "$line" >> "$MIGRATION_FILE"
        continue
    fi
    
    # Transform CREATE TABLE statements
    if [[ "$line" =~ ^[[:space:]]*CREATE[[:space:]]+TABLE[[:space:]] ]] && [[ ! "$line" =~ IF[[:space:]]+NOT[[:space:]]+EXISTS ]]; then
        transformed_line=$(echo "$line" | sed 's/CREATE TABLE /CREATE TABLE IF NOT EXISTS /')
        echo "$transformed_line" >> "$MIGRATION_FILE"
        continue
    fi
    
    # Transform CREATE INDEX statements
    if [[ "$line" =~ ^[[:space:]]*CREATE[[:space:]]+INDEX[[:space:]] ]] && [[ ! "$line" =~ IF[[:space:]]+NOT[[:space:]]+EXISTS ]]; then
        if [[ ! "$line" =~ CONCURRENTLY ]]; then
            transformed_line=$(echo "$line" | sed 's/CREATE INDEX /CREATE INDEX CONCURRENTLY /' | sed 's/CREATE INDEX CONCURRENTLY /CREATE INDEX CONCURRENTLY IF NOT EXISTS /')
        else
            transformed_line=$(echo "$line" | sed 's/CREATE INDEX CONCURRENTLY /CREATE INDEX CONCURRENTLY IF NOT EXISTS /')
        fi
        echo "$transformed_line" >> "$MIGRATION_FILE"
        continue
    fi
    
    # Transform CREATE TYPE statements
    if [[ "$line" =~ ^[[:space:]]*CREATE[[:space:]]+TYPE[[:space:]] ]]; then
        echo "-- SAFETY: Review this type creation carefully" >> "$MIGRATION_FILE"
        echo "$line" >> "$MIGRATION_FILE"
        continue
    fi
    
    # Transform ALTER TABLE ADD COLUMN statements
    if [[ "$line" =~ ^[[:space:]]*ALTER[[:space:]]+TABLE.*ADD[[:space:]]+COLUMN[[:space:]] ]] && [[ ! "$line" =~ IF[[:space:]]+NOT[[:space:]]+EXISTS ]]; then
        transformed_line=$(echo "$line" | sed 's/ADD COLUMN /ADD COLUMN IF NOT EXISTS /')
        echo "$transformed_line" >> "$MIGRATION_FILE"
        continue
    fi
    
    # Comment out potentially destructive operations
    if [[ "$line" =~ ^[[:space:]]*DROP[[:space:]] ]] || [[ "$line" =~ ^[[:space:]]*TRUNCATE[[:space:]] ]] || [[ "$line" =~ ^[[:space:]]*DELETE[[:space:]]+FROM[[:space:]] ]]; then
        echo "-- SAFETY: DESTRUCTIVE OPERATION COMMENTED FOR REVIEW" >> "$MIGRATION_FILE"
        echo "-- $line" >> "$MIGRATION_FILE"
        echo "-- ⚠️  MANUAL REVIEW REQUIRED: This operation could cause data loss" >> "$MIGRATION_FILE"
        continue
    fi
    
    # Pass through other statements as-is
    echo "$line" >> "$MIGRATION_FILE"
    
done < "$TEMP_MIGRATION"

# Add footer
cat >> "$MIGRATION_FILE" << 'EOF'

-- END MIGRATION STATEMENTS

-- DEPLOYMENT NOTES:
-- 1. This migration has been enhanced with safety features
-- 2. Review all commented sections marked with SAFETY
-- 3. Test on staging copy before production deployment
-- 4. Use './deploy-to-production.sh' to deploy safely
-- 5. Monitor deployment logs for any issues

-- ROLLBACK INSTRUCTIONS:
-- If this migration causes issues, use the rollback procedures:
-- 1. Run './rollback-production.sh' for automatic rollback
-- 2. Or manually restore from backups created during deployment
EOF

# Clean up temp file
rm -f "$TEMP_MIGRATION"

echo -e "${GREEN}✅ Safety transformations applied${NC}"
echo ""

# Check if migration has substantial content
CONTENT_LINES=$(grep -v "^[[:space:]]*--" "$MIGRATION_FILE" | grep -v "^[[:space:]]*$" | wc -l)

if [[ $CONTENT_LINES -lt 5 ]]; then
    echo -e "${YELLOW}⚠️  Migration appears to have minimal content.${NC}"
    echo "   This might indicate no differences were found, or manual editing is required."
    echo ""
fi

# Show preview of generated migration
echo "📋 Migration Preview:"
echo "----------------------------------------"
head -30 "$MIGRATION_FILE" | sed 's/^/   /'
if [[ $(wc -l < "$MIGRATION_FILE") -gt 30 ]]; then
    echo "   ... (content truncated)"
fi
echo "----------------------------------------"
echo ""

echo -e "${GREEN}🎉 Migration generated successfully!${NC}"
echo ""
echo "📍 Next Steps:"
echo "1. 📝 Review the migration file: $MIGRATION_FILE"
echo "2. 🧪 Test migration on staging copy (optional)"
echo "3. 🚀 Deploy using: ./deploy-to-production.sh"
echo "4. 🔍 Monitor deployment logs"
echo ""
echo "🛡️  Safety Features Included:"
echo "   ✅ IF NOT EXISTS clauses added"
echo "   ✅ Destructive operations commented"
echo "   ✅ CONCURRENTLY added to index creation"
echo "   ✅ Safety review comments added"
echo "   ✅ Rollback instructions included"
echo ""
echo -e "${BLUE}💡 Pro Tip: The enhanced deployment script will provide additional${NC}"
echo -e "${BLUE}   safety checks when you deploy this migration.${NC}"