#!/bin/bash

# 🗄️ Simple Database Migration Script
# Usage: npm run migrate:simple

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🗄️ Database Migration Tool${NC}"
echo -e "${BLUE}═══════════════════════════════${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${BLUE}Install with:${NC} npm i -g supabase"
    exit 1
fi

# Show migrations
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" | wc -l)
echo -e "${BLUE}📋 Found ${MIGRATION_COUNT} migration files${NC}"

echo -e "${YELLOW}🔧 Choose your target:${NC}"
echo "1) Production (xwsgyxlvxntgpochonwe)"
echo "2) Staging (pugnjgvdisdbdkbofwrc)" 
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        PROJECT_ID="xwsgyxlvxntgpochonwe"
        ENV_NAME="Production"
        echo -e "${RED}🚨 PRODUCTION ENVIRONMENT${NC}"
        ;;
    2)
        PROJECT_ID="pugnjgvdisdbdkbofwrc" 
        ENV_NAME="Staging"
        echo -e "${GREEN}🧪 STAGING ENVIRONMENT${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "📍 Target: ${YELLOW}$ENV_NAME${NC} ($PROJECT_ID)"

# Production confirmation
if [ "$choice" = "1" ]; then
    echo -e "${YELLOW}⚠️ Production migration requires confirmation${NC}"
    read -p "Are you sure you want to migrate production? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${BLUE}Migration cancelled${NC}"
        exit 0
    fi
fi

# Set up connection
echo -e "${BLUE}🔗 Setting up connection...${NC}"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-your_token_here}"

# Run migrations using direct connection
echo -e "${BLUE}🔄 Running migrations...${NC}"
echo -e "${CYAN}Command: supabase db push --db-url postgresql://postgres:[password]@db.${PROJECT_ID}.supabase.co:5432/postgres${NC}"
echo ""
echo -e "${YELLOW}⚠️ You'll need to run this manually with your database password:${NC}"
echo ""
echo -e "${GREEN}supabase db push --db-url \"postgresql://postgres:[YOUR_DB_PASSWORD]@db.${PROJECT_ID}.supabase.co:5432/postgres\"${NC}"
echo ""
echo -e "${BLUE}💡 Get your database password from Supabase Dashboard → Settings → Database${NC}"

echo -e "${BLUE}═══════════════════════════════${NC}"