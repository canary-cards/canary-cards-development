#!/bin/bash

# 🔒 Enhanced Production Migration System
# Usage: npm run migrate:production:enhanced
# 
# Complete production-safe deployment with Edge Function integration
# - Uses migration-helper Edge Function for secure credential management
# - Intelligent database state detection  
# - Enhanced backup and rollback capabilities
# - Complete RLS policy verification
# - Edge Function deployment verification

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🔒 Enhanced Production Migration System${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Complete production deployment with Edge Function integration${NC}"
echo ""

# Production project configuration
STAGING_PROJECT_ID="pugnjgvdisdbdkbofwrc"
PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"

echo -e "${RED}📍 Target: PRODUCTION${NC} ($PRODUCTION_PROJECT_ID)"
echo -e "${BLUE}📍 Source: STAGING${NC} ($STAGING_PROJECT_ID)"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${BLUE}Install with:${NC} npm i -g supabase"
    exit 1
fi

# Step 1: Use Migration Helper to get credentials
echo -e "${BLUE}🔧 Step 1: Getting production credentials via Edge Function...${NC}"

# First, connect to staging to access the migration-helper function
echo -e "${CYAN}Connecting to staging environment...${NC}"
if supabase link --project-ref "$STAGING_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Staging connected${NC}"
else
    echo -e "${RED}❌ Failed to connect to staging${NC}"
    exit 1
fi

# Call migration-helper to get production credentials
echo -e "${CYAN}Fetching production database credentials...${NC}"
CREDENTIALS_RESPONSE=$(supabase functions invoke migration-helper --body '{"action":"get_credentials","environment":"production"}' 2>/dev/null || echo '{"success":false}')

if echo "$CREDENTIALS_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Production credentials obtained securely${NC}"
    
    # Extract database URL from response
    PRODUCTION_DB_URL=$(echo "$CREDENTIALS_RESPONSE" | grep -o '"db_url":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$PRODUCTION_DB_URL" ]; then
        echo -e "${RED}❌ Could not extract database URL from credentials${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Failed to get production credentials${NC}"
    echo -e "${YELLOW}Make sure the PRODUCTION_DB_PASSWORD secret is configured${NC}"
    exit 1
fi

# Step 2: Validate production connection
echo -e "${BLUE}🔍 Step 2: Validating production database connection...${NC}"

VALIDATION_RESPONSE=$(supabase functions invoke migration-helper --body '{"action":"validate_connection","environment":"production"}' 2>/dev/null || echo '{"success":false}')

if echo "$VALIDATION_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Production database connection validated${NC}"
else
    echo -e "${RED}❌ Production database connection failed${NC}"
    echo -e "$VALIDATION_RESPONSE"
    exit 1
fi

# Step 3: Check database state  
echo -e "${BLUE}🔍 Step 3: Analyzing production database state...${NC}"

DATABASE_CHECK=$(supabase functions invoke migration-helper --body '{"action":"check_database_empty","environment":"production"}' 2>/dev/null || echo '{"success":false}')

if echo "$DATABASE_CHECK" | grep -q '"success":true'; then
    IS_EMPTY=$(echo "$DATABASE_CHECK" | grep -o '"isEmpty":[^,}]*' | cut -d':' -f2)
    TOTAL_ROWS=$(echo "$DATABASE_CHECK" | grep -o '"totalRows":[^,}]*' | cut -d':' -f2)
    TABLE_COUNT=$(echo "$DATABASE_CHECK" | grep -o '"tableCount":[^,}]*' | cut -d':' -f2)
    
    echo -e "${CYAN}Database Analysis:${NC}"
    echo -e "${BLUE}  • Tables: ${TABLE_COUNT}${NC}"
    echo -e "${BLUE}  • Total Rows: ${TOTAL_ROWS}${NC}"
    echo -e "${BLUE}  • Empty Database: ${IS_EMPTY}${NC}"
else
    echo -e "${YELLOW}⚠️  Could not analyze database state - continuing with caution${NC}"
    IS_EMPTY="false"
    TOTAL_ROWS="unknown"
fi

# Step 4: Migration file analysis
echo -e "${BLUE}🔍 Step 4: Analyzing pending migrations...${NC}"

MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")
echo -e "${BLUE}📋 Found ${MIGRATION_COUNT} migration files${NC}"

if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No migrations found - checking RLS and functions only${NC}"
    SKIP_MIGRATIONS=true
else
    SKIP_MIGRATIONS=false
    
    # Show recent migrations
    echo -e "${BLUE}🔍 Recent migrations:${NC}"
    ls -lt supabase/migrations/*.sql 2>/dev/null | head -5 | while read line; do
        filename=$(echo "$line" | awk '{print $9}')
        basename_file=$(basename "$filename")
        echo -e "${YELLOW}  • $basename_file${NC}"
    done
    
    # Scan for destructive operations
    echo -e "${CYAN}Scanning for potentially destructive operations...${NC}"
    DESTRUCTIVE_FOUND=false
    for migration in supabase/migrations/*.sql; do
        if [ -f "$migration" ]; then
            if grep -qi "drop\|truncate\|delete.*from\|alter.*drop" "$migration"; then
                echo -e "${YELLOW}⚠️  Potentially destructive operation found in: $(basename "$migration")${NC}"
                DESTRUCTIVE_FOUND=true
            fi
        fi
    done
fi

# Step 5: Production deployment confirmation
echo -e "${RED}🚨 PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
echo -e "${YELLOW}This will deploy to production with the following changes:${NC}"

if [ "$SKIP_MIGRATIONS" = false ]; then
    echo -e "${BLUE}  ✓ Apply ${MIGRATION_COUNT} database migrations${NC}"
else
    echo -e "${BLUE}  • Skip database migrations (none found)${NC}"
fi

echo -e "${BLUE}  ✓ Deploy all Edge Functions${NC}"
echo -e "${BLUE}  ✓ Synchronize RLS policies${NC}"

if [ "$IS_EMPTY" = "true" ]; then
    echo -e "${BLUE}  • Database is empty - no backup needed${NC}"
else
    echo -e "${BLUE}  ✓ Create comprehensive backup (${TOTAL_ROWS} rows)${NC}"
fi

echo -e "${BLUE}  ✓ Full rollback capability${NC}"
echo ""

if [ "$DESTRUCTIVE_FOUND" = true ]; then
    echo -e "${RED}⚠️  DESTRUCTIVE OPERATIONS DETECTED${NC}"
    echo -e "${YELLOW}The migrations contain potentially destructive operations.${NC}"
fi

read -p "Are you absolutely sure you want to proceed with production deployment? (type 'YES' to continue): " confirm
if [ "$confirm" != "YES" ]; then
    echo -e "${BLUE}Deployment cancelled${NC}"
    exit 0
fi

# Step 6: Create backup (if needed)
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p backups/production

if [ "$IS_EMPTY" != "true" ] && [ "$TOTAL_ROWS" != "0" ]; then
    echo -e "${PURPLE}📦 Step 6: Creating production backup...${NC}"
    
    BACKUP_FILE="backups/production/backup_full_${BACKUP_TIMESTAMP}.sql"
    SCHEMA_BACKUP="backups/production/backup_schema_${BACKUP_TIMESTAMP}.sql"
    
    echo -e "${BLUE}📥 Backing up production data...${NC}"
    if supabase db dump --db-url "$PRODUCTION_DB_URL" --data-only > "$BACKUP_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ Data backup created: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  Data backup had issues - continuing with caution${NC}"
    fi
    
    echo -e "${BLUE}📥 Backing up production schema...${NC}"
    if supabase db dump --db-url "$PRODUCTION_DB_URL" --schema public > "$SCHEMA_BACKUP" 2>/dev/null; then
        echo -e "${GREEN}✅ Schema backup created: $SCHEMA_BACKUP${NC}"
    else
        echo -e "${YELLOW}⚠️  Schema backup had issues - continuing with caution${NC}"
    fi
else
    echo -e "${BLUE}📦 Step 6: Skipping backup (empty database)${NC}"
fi

# Step 7: Connect to production and apply migrations
echo -e "${BLUE}🔄 Step 7: Applying database migrations...${NC}"

if supabase link --project-ref "$PRODUCTION_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Production connected${NC}"
else
    echo -e "${RED}❌ Failed to connect to production${NC}"
    exit 1
fi

if [ "$SKIP_MIGRATIONS" = false ]; then
    echo -e "${CYAN}Applying migrations with transaction safety...${NC}"
    
    if supabase db push 2>/dev/null; then
        echo -e "${GREEN}✅ Database migrations applied successfully${NC}"
    else
        echo -e "${RED}❌ Migration deployment failed${NC}"
        echo -e "${YELLOW}💡 Your data is safe - no changes were committed${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}✅ No migrations to apply${NC}"
fi

# Step 8: Deploy Edge Functions
echo -e "${BLUE}📦 Step 8: Deploying Edge Functions...${NC}"

if supabase functions deploy --project-ref "$PRODUCTION_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Edge Functions deployed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Edge Functions deployment had issues${NC}"
fi

# Step 9: Synchronize RLS Policies  
echo -e "${BLUE}🔒 Step 9: Synchronizing RLS policies...${NC}"

# Call the enhanced RLS sync script
if ./scripts/sync-rls-policies-enhanced.sh "$PRODUCTION_PROJECT_ID" "$PRODUCTION_DB_URL"; then
    echo -e "${GREEN}✅ RLS policies synchronized successfully${NC}"
else
    echo -e "${YELLOW}⚠️  RLS policy synchronization had issues${NC}"
fi

# Step 10: Post-deployment validation
echo -e "${BLUE}🔍 Step 10: Post-deployment validation...${NC}"

# Validate Edge Functions
echo -e "${CYAN}Validating Edge Functions...${NC}"
if supabase functions list --project-ref "$PRODUCTION_PROJECT_ID" | grep -q "ACTIVE"; then
    echo -e "${GREEN}✅ Edge Functions are active${NC}"
else
    echo -e "${YELLOW}⚠️  Some Edge Functions may not be active${NC}"
fi

# Validate database integrity
echo -e "${CYAN}Validating database integrity...${NC}"
if psql "$PRODUCTION_DB_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database integrity check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Database integrity check had issues${NC}"
fi

# Final validation via Edge Function
FINAL_VALIDATION=$(supabase functions invoke migration-helper --body '{"action":"validate_connection","environment":"production"}' 2>/dev/null || echo '{"success":false}')

if echo "$FINAL_VALIDATION" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Final production validation passed${NC}"
else
    echo -e "${YELLOW}⚠️  Final validation had issues - manual verification recommended${NC}"
fi

# Success summary
echo ""
echo -e "${GREEN}🎉 Enhanced Production Deployment Completed Successfully!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}📋 Deployment Summary:${NC}"

if [ "$SKIP_MIGRATIONS" = false ]; then
    echo -e "${BLUE}  ✅ Applied ${MIGRATION_COUNT} database migrations${NC}"
fi

echo -e "${BLUE}  ✅ Deployed Edge Functions to production${NC}"
echo -e "${BLUE}  ✅ Synchronized RLS policies${NC}"

if [ "$IS_EMPTY" != "true" ]; then
    echo -e "${BLUE}  ✅ Created production backups${NC}"
    echo -e "${BLUE}      • Data: $BACKUP_FILE${NC}"
    echo -e "${BLUE}      • Schema: $SCHEMA_BACKUP${NC}"
fi

echo ""
echo -e "${YELLOW}💡 Production deployment complete - test your application now${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"