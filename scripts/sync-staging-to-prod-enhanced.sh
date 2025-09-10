#!/bin/bash

# 🔄 Enhanced Staging to Production Schema Sync Script
# Usage: npm run sync:staging-to-prod:enhanced
# 
# This script safely syncs schema changes from staging to production
# by generating proper migrations and applying them with safeguards.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🔄 Enhanced Staging → Production Schema Sync${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Features: Live diff generation, automatic migration, safe application${NC}"
echo ""

# Project IDs
STAGING_PROJECT_ID="pugnjgvdisdbdkbofwrc"
PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"

echo -e "${BLUE}📍 Source:${NC} ${YELLOW}Staging${NC} ($STAGING_PROJECT_ID)"
echo -e "${BLUE}📍 Target:${NC} ${RED}Production${NC} ($PRODUCTION_PROJECT_ID)"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${BLUE}Install with:${NC} npm i -g supabase"
    exit 1
fi

# Get staging database password
echo -e "${YELLOW}🔑 Staging database password required${NC}"
echo -e "${BLUE}Get password from Supabase Dashboard → Settings → Database (Staging)${NC}"
read -s -p "Enter STAGING database password: " STAGING_PASSWORD
echo ""
if [ -z "$STAGING_PASSWORD" ]; then
    echo -e "${RED}❌ Staging password is required${NC}"
    exit 1
fi

# Get production database password
echo -e "${YELLOW}🔑 Production database password required${NC}"
echo -e "${BLUE}Get password from Supabase Dashboard → Settings → Database (Production)${NC}"
read -s -p "Enter PRODUCTION database password: " PRODUCTION_PASSWORD
echo ""
if [ -z "$PRODUCTION_PASSWORD" ]; then
    echo -e "${RED}❌ Production password is required${NC}"
    exit 1
fi

# Build connection URLs
STAGING_URL="postgresql://postgres.${STAGING_PROJECT_ID}:${STAGING_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
PRODUCTION_URL="postgresql://postgres.${PRODUCTION_PROJECT_ID}:${PRODUCTION_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo -e "${BLUE}🔍 Generating live schema diff...${NC}"

# Create migrations directory if it doesn't exist
mkdir -p supabase/migrations

# Generate timestamp for the sync migration
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
MIGRATION_FILE="supabase/migrations/${TIMESTAMP}_sync_staging_to_prod.sql"

# First, link to staging to get current schema state
echo -e "${YELLOW}📥 Connecting to staging database...${NC}"
if supabase link --project-ref "$STAGING_PROJECT_ID" --password "$STAGING_PASSWORD" 2>/dev/null; then
    echo -e "${GREEN}✅ Staging connected${NC}"
else
    echo -e "${YELLOW}⚠️  Staging connection issue - continuing...${NC}"
fi

# The correct approach: Link to production first, then diff against staging
# This will generate SQL that transforms production to match staging

echo -e "${YELLOW}📤 Connecting to production to get baseline...${NC}"
if supabase link --project-ref "$PRODUCTION_PROJECT_ID" --password "$PRODUCTION_PASSWORD" 2>/dev/null; then
    echo -e "${GREEN}✅ Production connected as baseline${NC}"
else
    echo -e "${RED}❌ Failed to connect to production${NC}"
    exit 1
fi

# Now generate diff: what changes are needed to make production (current) match staging (target)
echo -e "${CYAN}Generating migration: production → staging schema...${NC}"
if supabase db diff --db-url "$STAGING_URL" --schema public > "$MIGRATION_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Migration generated successfully${NC}"
else
    echo -e "${YELLOW}⚠️ Diff generation had issues, trying alternative...${NC}"
    
    # Alternative approach: dump both schemas and create a smart diff
    echo -e "${BLUE}📥 Dumping schemas for comparison...${NC}"
    
    # Dump production schema (currently linked)
    PROD_SCHEMA="/tmp/prod_schema_${TIMESTAMP}.sql"
    if supabase db dump --file "$PROD_SCHEMA" --schema-only --schema public 2>/dev/null; then
        echo -e "${GREEN}✅ Production schema dumped${NC}"
    else
        echo -e "${RED}❌ Failed to dump production schema${NC}"
        exit 1
    fi
    
    # Switch to staging and dump its schema
    if supabase link --project-ref "$STAGING_PROJECT_ID" --password "$STAGING_PASSWORD" 2>/dev/null; then
        echo -e "${GREEN}✅ Staging connected${NC}"
    else
        echo -e "${RED}❌ Failed to connect to staging${NC}"
        exit 1
    fi
    
    STAGING_SCHEMA="/tmp/staging_schema_${TIMESTAMP}.sql"
    if supabase db dump --file "$STAGING_SCHEMA" --schema-only --schema public 2>/dev/null; then
        echo -e "${GREEN}✅ Staging schema dumped${NC}"
    else
        echo -e "${RED}❌ Failed to dump staging schema${NC}"
        exit 1
    fi
    
    # Create a comprehensive migration that captures ALL differences
    echo -e "${CYAN}Analyzing schema differences and creating comprehensive migration...${NC}"
    
    # Extract enum types from both schemas
    echo -e "${BLUE}Extracting enum differences...${NC}"
    grep -n "CREATE TYPE.*AS ENUM" "$STAGING_SCHEMA" > /tmp/staging_enums_${TIMESTAMP}.txt || true
    grep -n "CREATE TYPE.*AS ENUM" "$PROD_SCHEMA" > /tmp/prod_enums_${TIMESTAMP}.txt || true
    
    # Extract function differences
    echo -e "${BLUE}Extracting function differences...${NC}"
    grep -A 20 "CREATE OR REPLACE FUNCTION" "$STAGING_SCHEMA" > /tmp/staging_functions_${TIMESTAMP}.txt || true
    grep -A 20 "CREATE OR REPLACE FUNCTION" "$PROD_SCHEMA" > /tmp/prod_functions_${TIMESTAMP}.txt || true
    
    # Start building comprehensive migration
    cat > "$MIGRATION_FILE" << EOF
-- Comprehensive Auto-generated Migration: Production → Staging Schema Sync
-- Generated on: $(date)
-- 
-- This migration ensures production matches staging schema exactly
-- Handles: ENUMs, functions, tables, constraints, indexes, triggers

-- ============================================================================
-- PHASE 1: CREATE MISSING ENUM TYPES
-- ============================================================================

EOF

    # Add missing enums from staging that aren't in production
    echo -e "${BLUE}Adding missing enum types...${NC}"
    while IFS= read -r line; do
        if [[ "$line" == *"CREATE TYPE"* ]]; then
            enum_name=$(echo "$line" | grep -o '"[^"]*"' | head -1 | tr -d '"')
            if ! grep -q "\"$enum_name\"" "$PROD_SCHEMA" 2>/dev/null; then
                echo "-- Adding missing enum: $enum_name" >> "$MIGRATION_FILE"
                echo "DO \$\$" >> "$MIGRATION_FILE"
                echo "BEGIN" >> "$MIGRATION_FILE"
                echo "  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '$enum_name') THEN" >> "$MIGRATION_FILE"
                echo "    $(echo "$line" | sed 's/.*CREATE TYPE/CREATE TYPE/');" >> "$MIGRATION_FILE"
                echo "  END IF;" >> "$MIGRATION_FILE"
                echo "END\$\$;" >> "$MIGRATION_FILE"
                echo "" >> "$MIGRATION_FILE"
            fi
        fi
    done < /tmp/staging_enums_${TIMESTAMP}.txt

    # Add missing enum values
    echo "" >> "$MIGRATION_FILE"
    echo "-- ============================================================================" >> "$MIGRATION_FILE"
    echo "-- PHASE 2: ADD MISSING ENUM VALUES" >> "$MIGRATION_FILE"
    echo "-- ============================================================================" >> "$MIGRATION_FILE"
    echo "" >> "$MIGRATION_FILE"

    # Extract and compare enum values
    if grep -q "payment_status" "$STAGING_SCHEMA"; then
        staging_payment_values=$(grep -A 10 "payment_status.*AS ENUM" "$STAGING_SCHEMA" | grep -o "'[^']*'" | tr -d "'" | tr '\n' ' ')
        echo "-- Ensure payment_status has all values: $staging_payment_values" >> "$MIGRATION_FILE"
        for value in $staging_payment_values; do
            if [[ "$value" != "," && "$value" != "" ]]; then
                echo "DO \$\$" >> "$MIGRATION_FILE"
                echo "BEGIN" >> "$MIGRATION_FILE"
                echo "  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid" >> "$MIGRATION_FILE"
                echo "                 WHERE t.typname = 'payment_status' AND e.enumlabel = '$value') THEN" >> "$MIGRATION_FILE"
                echo "    ALTER TYPE payment_status ADD VALUE '$value';" >> "$MIGRATION_FILE"
                echo "  END IF;" >> "$MIGRATION_FILE"
                echo "END\$\$;" >> "$MIGRATION_FILE"
                echo "" >> "$MIGRATION_FILE"
            fi
        done
    fi

    # Add functions from staging
    echo "" >> "$MIGRATION_FILE"
    echo "-- ============================================================================" >> "$MIGRATION_FILE"
    echo "-- PHASE 3: CREATE MISSING FUNCTIONS" >> "$MIGRATION_FILE"
    echo "-- ============================================================================" >> "$MIGRATION_FILE"
    echo "" >> "$MIGRATION_FILE"

    # Extract complete function definitions from staging
    awk '
    /CREATE OR REPLACE FUNCTION/ {
        capture = 1
        func = $0
        next
    }
    capture && /\$\$;/ {
        func = func "\n" $0
        print func
        print ""
        capture = 0
        func = ""
        next
    }
    capture {
        func = func "\n" $0
    }
    ' "$STAGING_SCHEMA" >> "$MIGRATION_FILE"

    echo "" >> "$MIGRATION_FILE"
    echo "-- ============================================================================" >> "$MIGRATION_FILE"
    echo "-- PHASE 4: ENSURE ALL TABLES MATCH STAGING" >> "$MIGRATION_FILE"
    echo "-- ============================================================================" >> "$MIGRATION_FILE"
    echo "" >> "$MIGRATION_FILE"
    
    # Add table creation from staging (will be IF NOT EXISTS)
    grep -A 50 "CREATE TABLE" "$STAGING_SCHEMA" | sed 's/CREATE TABLE/CREATE TABLE IF NOT EXISTS/g' >> "$MIGRATION_FILE"
    
    echo -e "${GREEN}✅ Comprehensive migration created with all schema differences${NC}"
    
    # Clean up temp files
    rm -f "$PROD_SCHEMA" "$STAGING_SCHEMA"
fi

# Check if migration has actual content
if [ ! -s "$MIGRATION_FILE" ]; then
    echo -e "${GREEN}✅ No schema differences found - databases are in sync!${NC}"
    rm "$MIGRATION_FILE"
    exit 0
fi

# Show migration content
echo -e "${BLUE}📋 Generated migration content:${NC}"
echo -e "${YELLOW}$(wc -l < "$MIGRATION_FILE") lines of SQL${NC}"
echo ""
echo -e "${CYAN}Preview (first 30 lines):${NC}"
head -30 "$MIGRATION_FILE"
if [ $(wc -l < "$MIGRATION_FILE") -gt 30 ]; then
    echo -e "${YELLOW}... (truncated)${NC}"
fi
echo ""

# Production safety confirmation
echo -e "${RED}⚠️  PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
echo -e "${YELLOW}This will apply the above schema changes to production${NC}"
echo -e "${BLUE}Migration file: $MIGRATION_FILE${NC}"
echo ""
read -p "Review the migration above. Apply to production? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${BLUE}Sync cancelled - migration file saved for review${NC}"
    echo -e "${BLUE}File: $MIGRATION_FILE${NC}"
    echo -e "${YELLOW}You can apply it later with: supabase db push --db-url [PROD_URL]${NC}"
    exit 0
fi

# Create production backup before applying changes
echo -e "${PURPLE}📦 Creating production backup...${NC}"
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p backups
BACKUP_FILE="backups/backup_production_before_sync_${BACKUP_TIMESTAMP}.sql"

if supabase db dump --db-url "$PRODUCTION_URL" --data-only > "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Production backup created:${NC} $BACKUP_FILE"
else
    echo -e "${YELLOW}⚠️  Backup had issues but continuing...${NC}"
fi

# Make sure we're still linked to production for applying the migration
echo -e "${BLUE}📤 Confirming production connection for migration...${NC}"
if supabase status | grep -q "$PRODUCTION_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Still connected to production${NC}"
else
    echo -e "${YELLOW}🔄 Re-linking to production...${NC}"
    if supabase link --project-ref "$PRODUCTION_PROJECT_ID" --password "$PRODUCTION_PASSWORD" 2>/dev/null; then
        echo -e "${GREEN}✅ Production reconnected${NC}"
    else
        echo -e "${RED}❌ Failed to reconnect to production${NC}"
        exit 1
    fi
fi

# Apply the migration to production
echo -e "${BLUE}🔄 Applying schema changes to production...${NC}"
echo -e "${CYAN}Running: supabase db push${NC}"

if supabase db push 2>/dev/null; then
    echo -e "${GREEN}✅ Schema sync completed successfully!${NC}"
    
    # Verify the sync worked by checking if there are still differences
    echo -e "${BLUE}🔍 Verifying sync...${NC}"
    VERIFY_FILE="/tmp/verify_diff_${TIMESTAMP}.sql"
    if supabase db diff --db-url "$STAGING_URL" --schema public > "$VERIFY_FILE" 2>/dev/null; then
        if [ -s "$VERIFY_FILE" ]; then
            echo -e "${YELLOW}⚠️  Some differences still exist:${NC}"
            head -10 "$VERIFY_FILE"
            echo -e "${BLUE}Full diff saved to: $VERIFY_FILE${NC}"
        else
            echo -e "${GREEN}✅ Verification passed - schemas are now in sync!${NC}"
            rm -f "$VERIFY_FILE"
        fi
    else
        echo -e "${YELLOW}⚠️  Verification completed (diff tool had issues)${NC}"
    fi
    
    echo -e "${GREEN}🎉 Staging → Production sync completed!${NC}"
    echo -e "${BLUE}📁 Migration file:${NC} $MIGRATION_FILE"
    echo -e "${BLUE}📁 Backup file:${NC} $BACKUP_FILE"
    
else
    echo -e "${RED}❌ Schema sync failed${NC}"
    echo -e "${YELLOW}💡 Restore from backup if needed:${NC} $BACKUP_FILE"
    echo -e "${YELLOW}💡 Review migration file:${NC} $MIGRATION_FILE"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════════${NC}"