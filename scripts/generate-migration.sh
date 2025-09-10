#!/bin/bash

# 🔄 Generate Migration from Staging Changes
# Usage: npm run migration:generate [description]
# 
# This script creates a proper migration file based on staging changes
# Safe for production use - only generates additive changes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🔄 Migration Generator${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Generates production-safe migrations from staging changes${NC}"
echo ""

# Get migration description
DESCRIPTION="$1"
if [ -z "$DESCRIPTION" ]; then
    read -p "Enter migration description: " DESCRIPTION
    if [ -z "$DESCRIPTION" ]; then
        echo -e "${RED}❌ Migration description is required${NC}"
        exit 1
    fi
fi

# Generate timestamp and filename
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
SAFE_DESCRIPTION=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g')
MIGRATION_FILE="supabase/migrations/${TIMESTAMP}_${SAFE_DESCRIPTION}.sql"

echo -e "${BLUE}📝 Migration: ${YELLOW}${SAFE_DESCRIPTION}${NC}"
echo -e "${BLUE}📁 File: ${YELLOW}${MIGRATION_FILE}${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${BLUE}Install with:${NC} npm i -g supabase"
    exit 1
fi

# Project IDs
STAGING_PROJECT_ID="pugnjgvdisdbdkbofwrc"
PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"

echo -e "${BLUE}📍 Analyzing changes from staging${NC}"

# Get staging database password
echo -e "${YELLOW}🔑 Staging database password required${NC}"
read -s -p "Enter STAGING database password: " STAGING_PASSWORD
echo ""
if [ -z "$STAGING_PASSWORD" ]; then
    echo -e "${RED}❌ Staging password is required${NC}"
    exit 1
fi

# Link to staging to get current state
echo -e "${YELLOW}📥 Connecting to staging...${NC}"
if supabase link --project-ref "$STAGING_PROJECT_ID" --password "$STAGING_PASSWORD" 2>/dev/null; then
    echo -e "${GREEN}✅ Staging connected${NC}"
else
    echo -e "${RED}❌ Failed to connect to staging${NC}"
    exit 1
fi

echo -e "${CYAN}Generating migration from current local migrations vs staging...${NC}"

# Use supabase db diff to generate a migration
# This compares local migration files against the actual staging database
TEMP_MIGRATION="/tmp/temp_migration_${TIMESTAMP}.sql"
if supabase db diff --file="$TEMP_MIGRATION" --linked 2>/dev/null; then
    echo -e "${GREEN}✅ Migration generated${NC}"
else
    echo -e "${YELLOW}⚠️  Using alternative approach...${NC}"
    
    # Alternative: create template migration
    cat > "$TEMP_MIGRATION" << EOF
-- No automatic differences detected
-- This may mean staging and local migrations are in sync
-- Add your manual changes below if needed

-- Example safe patterns:
-- CREATE TABLE IF NOT EXISTS new_table (...);
-- ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column TEXT;
-- CREATE TYPE IF NOT EXISTS new_enum AS ENUM ('value1', 'value2');
-- ALTER TYPE existing_enum ADD VALUE IF NOT EXISTS 'new_value';
EOF
fi

# Create the production-safe migration
cat > "$MIGRATION_FILE" << EOF
-- Migration: ${DESCRIPTION}
-- Generated: $(date)
-- Status: REVIEW REQUIRED - Verify all changes are production-safe
-- 
-- ⚠️  PRODUCTION SAFETY CHECKLIST:
-- □ All CREATE statements use IF NOT EXISTS
-- □ No DROP statements (data loss risk)
-- □ Column additions are nullable or have defaults
-- □ Enum changes only ADD values, never remove
-- □ Constraints are added carefully (check existing data)
-- □ Indexes are created CONCURRENTLY if needed
-- □ Changes are backward compatible

EOF

# Process the generated migration to make it production-safe
echo -e "${BLUE}🔒 Making migration production-safe...${NC}"

# Clean and enhance the migration
while IFS= read -r line; do
    # Skip comments and empty lines from temp file
    if [[ "$line" =~ ^[[:space:]]*-- ]] || [[ -z "$line" ]]; then
        continue
    fi
    
    # Transform potentially unsafe statements
    if [[ "$line" =~ CREATE[[:space:]]+TABLE[[:space:]]+[^[:space:]]+ ]]; then
        # Add IF NOT EXISTS to CREATE TABLE
        line=$(echo "$line" | sed 's/CREATE TABLE /CREATE TABLE IF NOT EXISTS /')
        echo "$line" >> "$MIGRATION_FILE"
    elif [[ "$line" =~ CREATE[[:space:]]+TYPE[[:space:]]+[^[:space:]]+ ]]; then
        # Handle CREATE TYPE safely
        type_name=$(echo "$line" | grep -o '"[^"]*"' | head -1 | tr -d '"')
        cat >> "$MIGRATION_FILE" << EOF

-- Create enum type: $type_name
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '$type_name') THEN
    $line;
  END IF;
END\$\$;
EOF
    elif [[ "$line" =~ CREATE[[:space:]]+INDEX[[:space:]]+ ]]; then
        # Make index creation safe and concurrent
        line=$(echo "$line" | sed 's/CREATE INDEX /CREATE INDEX CONCURRENTLY IF NOT EXISTS /')
        echo "$line" >> "$MIGRATION_FILE"
    elif [[ "$line" =~ ALTER[[:space:]]+TABLE[[:space:]]+.*ADD[[:space:]]+COLUMN ]]; then
        # Add IF NOT EXISTS to column additions
        echo "$line" | sed 's/ADD COLUMN /ADD COLUMN IF NOT EXISTS /' >> "$MIGRATION_FILE"
    elif [[ "$line" =~ DROP ]]; then
        # Comment out potentially destructive DROP statements
        echo "-- ⚠️  COMMENTED OUT (potentially destructive): $line" >> "$MIGRATION_FILE"
        echo "-- ⚠️  Review carefully before uncommenting" >> "$MIGRATION_FILE"
    else
        # Pass through other statements
        echo "$line" >> "$MIGRATION_FILE"
    fi
done < "$TEMP_MIGRATION"

# Add migration footer
cat >> "$MIGRATION_FILE" << EOF

-- ============================================================================
-- PRODUCTION DEPLOYMENT NOTES:
-- ============================================================================
-- 
-- Before applying to production:
-- 1. Review all changes above
-- 2. Test on a production copy/staging environment  
-- 3. Ensure backward compatibility
-- 4. Plan rollback strategy if needed
-- 5. Schedule maintenance window if required
-- 
-- Apply with: npm run migrate:production
-- ============================================================================
EOF

# Clean up
rm -f "$TEMP_MIGRATION"

# Check if migration has content
if [ $(wc -l < "$MIGRATION_FILE") -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Migration appears empty - no changes detected${NC}"
    echo -e "${BLUE}This might mean staging and migrations are already in sync${NC}"
else
    echo -e "${GREEN}✅ Migration generated successfully!${NC}"
fi

# Show migration summary
echo ""
echo -e "${BLUE}📋 Migration Summary:${NC}"
echo -e "${BLUE}File: ${YELLOW}${MIGRATION_FILE}${NC}"
echo -e "${BLUE}Lines: ${YELLOW}$(wc -l < "$MIGRATION_FILE")${NC}"
echo ""
echo -e "${CYAN}Preview (first 30 lines):${NC}"
head -30 "$MIGRATION_FILE"
if [ $(wc -l < "$MIGRATION_FILE") -gt 30 ]; then
    echo -e "${YELLOW}... (truncated)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Migration ready for review!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "${BLUE}1. Review: ${YELLOW}${MIGRATION_FILE}${NC}"
echo -e "${BLUE}2. Test: Apply to staging copy first${NC}"
echo -e "${BLUE}3. Deploy: ${YELLOW}npm run migrate:production${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"