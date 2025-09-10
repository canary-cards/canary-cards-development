#!/bin/bash

# 🔄 Staging to Production Schema Sync Script
# Usage: npm run sync:staging-to-prod

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🔄 Staging → Production Schema Sync${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"

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
STAGING_URL="postgresql://postgres:${STAGING_PASSWORD}@db.${STAGING_PROJECT_ID}.supabase.co:5432/postgres"
PRODUCTION_URL="postgresql://postgres:${PRODUCTION_PASSWORD}@db.${PRODUCTION_PROJECT_ID}.supabase.co:5432/postgres"

echo -e "${BLUE}🔍 Analyzing schema differences...${NC}"

# Create migrations directory if it doesn't exist
mkdir -p supabase/migrations

# Generate timestamp for the sync migration
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
MIGRATION_FILE="supabase/migrations/${TIMESTAMP}_sync_staging_to_prod.sql"

# Generate diff between staging and production
echo -e "${CYAN}Generating schema diff...${NC}"
if supabase db diff --db-url "$STAGING_URL" --schema public > "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Schema diff generated:${NC} $MIGRATION_FILE"
else
    echo -e "${RED}❌ Failed to generate schema diff${NC}"
    exit 1
fi

# Check if there are any differences
if [ ! -s "$MIGRATION_FILE" ]; then
    echo -e "${GREEN}✅ No schema differences found - databases are in sync!${NC}"
    rm "$MIGRATION_FILE"
    exit 0
fi

echo -e "${BLUE}📋 Schema differences found:${NC}"
echo -e "${YELLOW}$(wc -l < "$MIGRATION_FILE") lines of changes${NC}"

# Show preview of changes
echo -e "${BLUE}🔍 Preview of changes:${NC}"
head -20 "$MIGRATION_FILE"
if [ $(wc -l < "$MIGRATION_FILE") -gt 20 ]; then
    echo -e "${YELLOW}... (showing first 20 lines)${NC}"
fi

# Production safety confirmation
echo -e "${RED}⚠️  PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
echo -e "${YELLOW}This will apply staging schema changes to production${NC}"
read -p "Are you sure you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${BLUE}Sync cancelled - migration file saved for review${NC}"
    echo -e "${BLUE}File: $MIGRATION_FILE${NC}"
    exit 0
fi

# Create production backup before applying changes
echo -e "${PURPLE}📦 Creating production backup...${NC}"
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p backups
BACKUP_FILE="backups/backup_production_before_sync_${BACKUP_TIMESTAMP}.sql"

if supabase db dump --db-url "$PRODUCTION_URL" --data-only > "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Production backup created:${NC} $BACKUP_FILE"
else
    echo -e "${RED}❌ Backup failed - aborting sync${NC}"
    exit 1
fi

# Apply the migration to production
echo -e "${BLUE}🔄 Applying schema changes to production...${NC}"
if supabase db push --db-url "$PRODUCTION_URL"; then
    echo -e "${GREEN}✅ Schema sync completed successfully!${NC}"
    
    # Verify the sync
    echo -e "${BLUE}🔍 Verifying sync...${NC}"
    supabase db diff --db-url "$PRODUCTION_URL" || echo -e "${YELLOW}⚠️  Verification completed${NC}"
    
    echo -e "${GREEN}🎉 Staging → Production sync completed!${NC}"
    echo -e "${BLUE}📁 Migration file:${NC} $MIGRATION_FILE"
    echo -e "${BLUE}📁 Backup file:${NC} $BACKUP_FILE"
else
    echo -e "${RED}❌ Schema sync failed${NC}"
    echo -e "${YELLOW}💡 Restore from backup if needed:${NC} $BACKUP_FILE"
    exit 1
fi

echo -e "${BLUE}════════════════════════════════════${NC}"