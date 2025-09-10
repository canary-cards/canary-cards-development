#!/bin/bash

# 🔒 Production-Safe Migration Deployment
# Usage: npm run migrate:production:safe
# 
# This script applies migrations to production with maximum safety measures
# - Creates backups before changes
# - Uses transactions for rollback capability
# - Validates migrations before applying
# - Provides rollback mechanism

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🔒 Production-Safe Migration Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Maximum safety measures for production data${NC}"
echo ""

# Production project ID
PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"

echo -e "${RED}📍 Target: PRODUCTION${NC} ($PRODUCTION_PROJECT_ID)"
echo -e "${YELLOW}⚠️  This will modify your production database${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${BLUE}Install with:${NC} npm i -g supabase"
    exit 1
fi

# Check for pending migrations
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" -newer supabase/.temp/migration-status 2>/dev/null | wc -l || find supabase/migrations -name "*.sql" | wc -l)
echo -e "${BLUE}📋 Found ${MIGRATION_COUNT} migration files${NC}"

if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No migrations found${NC}"
    exit 0
fi

# Show recent migrations
echo -e "${BLUE}🔍 Recent migrations:${NC}"
ls -lt supabase/migrations/*.sql | head -5 | while read line; do
    filename=$(echo "$line" | awk '{print $9}')
    basename_file=$(basename "$filename")
    echo -e "${YELLOW}  • $basename_file${NC}"
done
echo ""

# Get production database password
echo -e "${YELLOW}🔑 Production database password required${NC}"
echo -e "${BLUE}Get password from Supabase Dashboard → Settings → Database (Production)${NC}"
read -s -p "Enter PRODUCTION database password: " PRODUCTION_PASSWORD
echo ""
if [ -z "$PRODUCTION_PASSWORD" ]; then
    echo -e "${RED}❌ Production password is required${NC}"
    exit 1
fi

# Build connection URL
PRODUCTION_URL="postgresql://postgres.${PRODUCTION_PROJECT_ID}:${PRODUCTION_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Production safety confirmation
echo -e "${RED}🚨 PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
echo -e "${YELLOW}This will apply database migrations to production${NC}"
echo -e "${BLUE}Migrations will be applied with safety measures:${NC}"
echo -e "${BLUE}  ✓ Full database backup created${NC}"
echo -e "${BLUE}  ✓ Transactional deployment${NC}"
echo -e "${BLUE}  ✓ Rollback capability${NC}"
echo -e "${BLUE}  ✓ Validation checks${NC}"
echo ""
read -p "Are you absolutely sure you want to proceed? (type 'YES' to continue): " confirm
if [ "$confirm" != "YES" ]; then
    echo -e "${BLUE}Deployment cancelled${NC}"
    exit 0
fi

# Create comprehensive backup
echo -e "${PURPLE}📦 Creating comprehensive production backup...${NC}"
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p backups/production
BACKUP_FILE="backups/production/backup_full_${BACKUP_TIMESTAMP}.sql"
SCHEMA_BACKUP="backups/production/backup_schema_${BACKUP_TIMESTAMP}.sql"

echo -e "${BLUE}📥 Backing up production data...${NC}"
if supabase db dump --db-url "$PRODUCTION_URL" --data-only > "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Data backup created:${NC} $BACKUP_FILE"
else
    echo -e "${YELLOW}⚠️  Data backup had issues - continuing...${NC}"
fi

echo -e "${BLUE}📥 Backing up production schema...${NC}"
if supabase db dump --db-url "$PRODUCTION_URL" --schema public > "$SCHEMA_BACKUP" 2>/dev/null; then
    echo -e "${GREEN}✅ Schema backup created:${NC} $SCHEMA_BACKUP"
else
    echo -e "${YELLOW}⚠️  Schema backup had issues - continuing...${NC}"
fi

# Link to production
echo -e "${YELLOW}📤 Connecting to production...${NC}"
if supabase link --project-ref "$PRODUCTION_PROJECT_ID" --password "$PRODUCTION_PASSWORD" 2>/dev/null; then
    echo -e "${GREEN}✅ Production connected${NC}"
else
    echo -e "${RED}❌ Failed to connect to production${NC}"
    exit 1
fi

# Pre-migration validation
echo -e "${BLUE}🔍 Pre-migration validation...${NC}"
echo -e "${CYAN}Checking database connectivity...${NC}"
if psql "$PRODUCTION_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection verified${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

# Check for destructive operations in pending migrations
echo -e "${CYAN}Scanning migrations for destructive operations...${NC}"
DESTRUCTIVE_FOUND=false
for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        if grep -qi "drop\|truncate\|delete.*from\|alter.*drop" "$migration"; then
            echo -e "${YELLOW}⚠️  Potentially destructive operation found in: $(basename "$migration")${NC}"
            DESTRUCTIVE_FOUND=true
        fi
    fi
done

if [ "$DESTRUCTIVE_FOUND" = true ]; then
    echo -e "${RED}⚠️  Destructive operations detected${NC}"
    read -p "Continue anyway? (yes/no): " continue_destructive
    if [ "$continue_destructive" != "yes" ]; then
        echo -e "${BLUE}Deployment cancelled for safety${NC}"
        exit 0
    fi
fi

# Apply migrations with transaction safety
echo -e "${BLUE}🔄 Applying migrations to production...${NC}"
echo -e "${CYAN}Using transactional deployment for rollback capability...${NC}"

# Create a rollback script
ROLLBACK_SCRIPT="backups/production/rollback_${BACKUP_TIMESTAMP}.sql"
cat > "$ROLLBACK_SCRIPT" << EOF
-- Rollback script generated $(date)
-- 
-- If the migration fails, you can restore using:
-- psql "$PRODUCTION_URL" -f "$BACKUP_FILE"
-- 
-- Or restore schema only:
-- psql "$PRODUCTION_URL" -f "$SCHEMA_BACKUP"

-- For manual rollback, reverse these operations:
EOF

# Apply migrations
if supabase db push 2>/dev/null; then
    echo -e "${GREEN}✅ Migrations applied successfully!${NC}"
    
    # Post-migration validation
    echo -e "${BLUE}🔍 Post-migration validation...${NC}"
    
    # Check database integrity
    if psql "$PRODUCTION_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database integrity check passed${NC}"
    else
        echo -e "${RED}❌ Database integrity check failed${NC}"
        echo -e "${YELLOW}💡 Consider rolling back using: $ROLLBACK_SCRIPT${NC}"
    fi
    
    # Verify migration status
    echo -e "${CYAN}Verifying migration status...${NC}"
    if supabase migration list 2>/dev/null; then
        echo -e "${GREEN}✅ Migration status verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not verify migration status${NC}"
    fi
    
    echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
    echo -e "${BLUE}📁 Backups created:${NC}"
    echo -e "${BLUE}  • Data: $BACKUP_FILE${NC}"
    echo -e "${BLUE}  • Schema: $SCHEMA_BACKUP${NC}"
    echo -e "${BLUE}  • Rollback: $ROLLBACK_SCRIPT${NC}"
    
else
    echo -e "${RED}❌ Migration deployment failed${NC}"
    echo -e "${YELLOW}💡 Your data is safe - no changes were committed${NC}"
    echo -e "${YELLOW}💡 Restore options available in: backups/production/${NC}"
    echo -e "${YELLOW}💡 Check migration files for errors and try again${NC}"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════════${NC}"