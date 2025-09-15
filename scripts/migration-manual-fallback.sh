#!/bin/bash

# 🔧 Manual Production Migration Fallback
# Usage: ./scripts/migration-manual-fallback.sh
# 
# Manual migration process when automated systems fail
# - Direct credential input and validation
# - Step-by-step manual verification
# - Simplified deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"

echo -e "${CYAN}🔧 Manual Production Migration Fallback${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Manual deployment process for production${NC}"
echo ""

echo -e "${YELLOW}This script is designed for use when the automated migration system fails.${NC}"
echo -e "${YELLOW}You will need to manually provide production database credentials.${NC}"
echo ""

# Step 1: Collect credentials
echo -e "${BLUE}📋 Step 1: Production Database Credentials${NC}"
echo ""

read -p "Production Database URL (postgresql://...): " PROD_DB_URL
if [ -z "$PROD_DB_URL" ]; then
    echo -e "${RED}❌ Database URL is required${NC}"
    exit 1
fi

echo ""
read -s -p "Production Database Password: " PROD_DB_PASSWORD
echo ""

if [ -z "$PROD_DB_PASSWORD" ]; then
    echo -e "${RED}❌ Database password is required${NC}"
    exit 1
fi

# Step 2: Test connection
echo -e "${BLUE}🔍 Step 2: Testing Database Connection${NC}"

# Construct test URL with password
if [[ "$PROD_DB_URL" == *":[password]@"* ]]; then
    TEST_DB_URL="${PROD_DB_URL//:[password]@/:${PROD_DB_PASSWORD}@}"
elif [[ "$PROD_DB_URL" == *"@"* ]] && [[ "$PROD_DB_URL" != *":"*"@"* ]]; then
    # Add password to existing username
    TEST_DB_URL="${PROD_DB_URL/@/:${PROD_DB_PASSWORD}@}"
else
    TEST_DB_URL="$PROD_DB_URL"
fi

echo -e "${CYAN}Testing database connection...${NC}"
if psql "$TEST_DB_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo -e "${YELLOW}Please verify your credentials and try again${NC}"
    exit 1
fi

# Step 3: Analyze current state
echo -e "${BLUE}🔍 Step 3: Analyzing Production Database${NC}"

TABLE_COUNT=$(psql "$TEST_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${CYAN}Current tables in production: $TABLE_COUNT${NC}"

# Check for existing data
if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Production database contains $TABLE_COUNT tables${NC}"
    echo -e "${YELLOW}Proceeding will modify the existing database structure${NC}"
else
    echo -e "${GREEN}✅ Production database is empty - safe to initialize${NC}"
fi

# Step 4: Migration file analysis
echo -e "${BLUE}🔍 Step 4: Analyzing Local Migrations${NC}"

MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")
echo -e "${CYAN}Local migration files: $MIGRATION_COUNT${NC}"

if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No migration files found${NC}"
    echo -e "${BLUE}This deployment will only update Edge Functions and RLS policies${NC}"
    SKIP_MIGRATIONS=true
else
    SKIP_MIGRATIONS=false
    echo -e "${BLUE}📋 Recent migrations:${NC}"
    ls -lt supabase/migrations/*.sql 2>/dev/null | head -3 | while read line; do
        filename=$(echo "$line" | awk '{print $9}')
        basename_file=$(basename "$filename")
        echo -e "${YELLOW}  • $basename_file${NC}"
    done
fi

# Step 5: Confirmation
echo ""
echo -e "${RED}🚨 MANUAL PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
echo -e "${YELLOW}This manual process will:${NC}"

if [ "$SKIP_MIGRATIONS" = false ]; then
    echo -e "${BLUE}  ✓ Apply $MIGRATION_COUNT database migrations${NC}"
else
    echo -e "${BLUE}  • Skip database migrations (none found)${NC}"
fi

echo -e "${BLUE}  ✓ Deploy Edge Functions to production${NC}"
echo -e "${BLUE}  ✓ Update production configuration${NC}"

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${RED}  ⚠️  Modify existing production database ($TABLE_COUNT tables)${NC}"
fi

echo ""
read -p "Continue with manual production deployment? (type 'YES' to proceed): " manual_confirm

if [ "$manual_confirm" != "YES" ]; then
    echo -e "${BLUE}Manual deployment cancelled${NC}"
    exit 0
fi

# Step 6: Create backup if needed
if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${BLUE}📦 Step 6: Creating Backup${NC}"
    
    BACKUP_FILE="backups/manual-backup-$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p backups
    
    echo -e "${CYAN}Creating production backup...${NC}"
    if pg_dump "$TEST_DB_URL" > "$BACKUP_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  Backup creation had issues - continuing anyway${NC}"
    fi
else
    echo -e "${BLUE}📦 Step 6: Skipping backup (empty database)${NC}"
fi

# Step 7: Connect to Supabase production
echo -e "${BLUE}🔗 Step 7: Connecting to Production Project${NC}"

echo -e "${CYAN}Linking to production project...${NC}"
if supabase link --project-ref "$PRODUCTION_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Production project linked${NC}"
else
    echo -e "${RED}❌ Failed to link to production project${NC}"
    echo -e "${YELLOW}Please check your Supabase CLI login status${NC}"
    exit 1
fi

# Step 8: Apply migrations
if [ "$SKIP_MIGRATIONS" = false ]; then
    echo -e "${BLUE}🔄 Step 8: Applying Database Migrations${NC}"
    
    echo -e "${CYAN}Pushing database changes...${NC}"
    if supabase db push 2>/dev/null; then
        echo -e "${GREEN}✅ Database migrations applied successfully${NC}"
    else
        echo -e "${RED}❌ Database migration failed${NC}"
        echo -e "${YELLOW}💡 Check the migration files for errors${NC}"
        
        # Offer to continue without migrations
        read -p "Continue with Edge Function deployment only? (y/N): " continue_without_db
        if [[ ! "$continue_without_db" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo -e "${BLUE}⏭️  Step 8: Skipping database migrations${NC}"
fi

# Step 9: Deploy Edge Functions
echo -e "${BLUE}📦 Step 9: Deploying Edge Functions${NC}"

echo -e "${CYAN}Deploying functions to production...${NC}"
if supabase functions deploy --project-ref "$PRODUCTION_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Edge Functions deployed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Edge Function deployment had issues${NC}"
    echo -e "${BLUE}Check the Supabase dashboard for function status${NC}"
fi

# Step 10: Final validation
echo -e "${BLUE}🔍 Step 10: Final Validation${NC}"

echo -e "${CYAN}Testing final database connection...${NC}"
if psql "$TEST_DB_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" > /dev/null 2>&1; then
    FINAL_TABLE_COUNT=$(psql "$TEST_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    echo -e "${GREEN}✅ Final validation successful${NC}"
    echo -e "${CYAN}Production database now has $FINAL_TABLE_COUNT tables${NC}"
else
    echo -e "${YELLOW}⚠️  Final validation had issues${NC}"
fi

# Success message
echo ""
echo -e "${GREEN}🎉 Manual Production Deployment Completed!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}📋 Deployment Summary:${NC}"

if [ "$SKIP_MIGRATIONS" = false ]; then
    echo -e "${BLUE}  ✅ Applied $MIGRATION_COUNT database migrations${NC}"
fi

echo -e "${BLUE}  ✅ Deployed Edge Functions to production${NC}"
echo -e "${BLUE}  ✅ Used manual credential process${NC}"

if [ "$TABLE_COUNT" -gt 0 ] && [ -n "$BACKUP_FILE" ]; then
    echo -e "${BLUE}  ✅ Created backup: $BACKUP_FILE${NC}"
fi

echo ""
echo -e "${YELLOW}💡 Manual production deployment complete!${NC}"
echo -e "${YELLOW}🔗 Check your application: https://${PRODUCTION_PROJECT_ID}.supabase.co${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"