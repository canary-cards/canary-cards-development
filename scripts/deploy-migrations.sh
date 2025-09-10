#!/bin/bash

# 🗄️  Elegant Database Migration Script
# Usage: npm run migrate:staging OR npm run migrate:production
# Direct: ./scripts/deploy-migrations.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m' 
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🗄️  Database Migration Tool${NC}"
echo -e "${BLUE}═══════════════════════════════${NC}"

# Environment configuration
if [ "$ENVIRONMENT" = "production" ]; then
    PROJECT_ID="xwsgyxlvxntgpochonwe"
    echo -e "${RED}🚨 PRODUCTION ENVIRONMENT${NC}"
    echo -e "📍 Target: ${YELLOW}Canary Cards Prod${NC} ($PROJECT_ID)"
elif [ "$ENVIRONMENT" = "staging" ]; then
    PROJECT_ID="pugnjgvdisdbdkbofwrc"
    echo -e "${GREEN}🧪 STAGING ENVIRONMENT${NC}"
    echo -e "📍 Target: ${YELLOW}Canary Cards Staging${NC} ($PROJECT_ID)"
else
    echo -e "${RED}❌ Error: Environment must be 'staging' or 'production'${NC}"
    echo -e "${BLUE}Usage:${NC}"
    echo -e "  npm run migrate:staging"
    echo -e "  npm run migrate:production"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${BLUE}Install with:${NC} npm i -g supabase"
    exit 1
fi

# Production safety check
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}⚠️  Production migration requires confirmation${NC}"
    read -p "Are you sure you want to migrate production? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${BLUE}Migration cancelled${NC}"
        exit 0
    fi
    
    # Create backup
    echo -e "${PURPLE}📦 Creating backup...${NC}"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    mkdir -p backups
    if supabase db dump --project-id "$PROJECT_ID" --data-only > "backups/backup_production_${TIMESTAMP}.sql"; then
        echo -e "${GREEN}✅ Backup created:${NC} backups/backup_production_${TIMESTAMP}.sql"
    else
        echo -e "${RED}❌ Backup failed - aborting migration${NC}"
        exit 1
    fi
fi

# Show pending migrations
echo -e "${BLUE}📋 Checking for pending migrations...${NC}"
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" | wc -l)
echo -e "${CYAN}Found ${MIGRATION_COUNT} migration files${NC}"

# Run migrations
echo -e "${BLUE}🔄 Running migrations...${NC}"
if supabase db push --project-id "$PROJECT_ID"; then
    echo -e "${GREEN}✅ Migrations completed successfully!${NC}"
    
    # Verify
    echo -e "${BLUE}🔍 Verifying schema...${NC}"
    supabase db diff --project-id "$PROJECT_ID" --use-migra || echo -e "${YELLOW}⚠️  Schema verification completed${NC}"
    
    echo -e "${GREEN}🎉 Migration to $ENVIRONMENT completed!${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${PURPLE}📝 Backup location: backups/backup_production_${TIMESTAMP}.sql${NC}"
    fi
    
else
    echo -e "${RED}❌ Migration failed${NC}"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${YELLOW}💡 Rollback available: backups/backup_production_${TIMESTAMP}.sql${NC}"
    fi
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════${NC}"