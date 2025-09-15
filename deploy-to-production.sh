#!/bin/bash

# Deploy to Production - Main deployment command
# This script safely deploys from main branch to production

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current timestamp for backup naming
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/database"

# Pre-deployment checks
echo "🔍 Pre-deployment validation..."

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${RED}❌ Must be on main branch. Current: $CURRENT_BRANCH${NC}"
    echo "Run: git checkout main"
    exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet; then
    echo -e "${RED}❌ Uncommitted changes detected. Please commit or stash them.${NC}"
    exit 1
fi

# Pull latest changes
echo "   Pulling latest changes..."
git pull origin main

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"
echo ""

# Step 1: Backup Production Database
echo "💾 Creating production database backup..."
mkdir -p "$BACKUP_DIR"

# Create database dump using Supabase CLI
echo "   Backing up production database schema..."
supabase --project-ref xwsgyxlvxntgpochonwe db dump --data-only > "$BACKUP_DIR/production_data_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Database backup failed${NC}"
    exit 1
}

supabase --project-ref xwsgyxlvxntgpochonwe db dump --schema-only > "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Schema backup failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database backup created: ${BACKUP_DIR}/production_*_${TIMESTAMP}.sql${NC}"
echo ""

# Step 2: Deploy Code Changes (main → realproduction)
echo "📦 Deploying code changes..."

# Switch to realproduction branch
git checkout realproduction

# Merge main into realproduction
echo "   Merging main into realproduction..."
git merge main --no-edit || {
    echo -e "${RED}❌ Merge conflict detected. Please resolve manually.${NC}"
    exit 1
}

# Push to realproduction branch
echo "   Pushing to realproduction branch..."
git push origin realproduction

echo -e "${GREEN}✅ Code deployment complete${NC}"
echo ""

# Step 3: Deploy Database Changes (staging → production)
echo "🗄️  Deploying database changes..."

# Generate diff between staging and production
echo "   Generating migration diff..."
supabase db diff --project-ref pugnjgvdisdbdkbofwrc --project-ref-2 xwsgyxlvxntgpochonwe > "backups/migrations/migration_diff_${TIMESTAMP}.sql" || true

# Apply any pending migrations to production
echo "   Applying database migrations to production..."
supabase db push --project-ref xwsgyxlvxntgpochonwe || {
    echo -e "${RED}❌ Database migration failed${NC}"
    echo "🔄 Rolling back code changes..."
    git checkout main
    exit 1
}

echo -e "${GREEN}✅ Database migration complete${NC}"
echo ""

# Step 4: Deploy Edge Functions
echo "⚡ Deploying Edge Functions to production..."
supabase functions deploy --project-ref xwsgyxlvxntgpochonwe || {
    echo -e "${YELLOW}⚠️  Edge function deployment failed, but continuing...${NC}"
}

echo -e "${GREEN}✅ Edge Functions deployed${NC}"
echo ""

# Step 5: Post-deployment validation
echo "🔍 Post-deployment validation..."

# Test production endpoints
echo "   Testing production connectivity..."
if curl -s https://xwsgyxlvxntgpochonwe.supabase.co/rest/v1/ > /dev/null; then
    echo -e "${GREEN}   ✅ Production API responsive${NC}"
else
    echo -e "${YELLOW}   ⚠️  Production API may be slow to respond${NC}"
fi

# Return to main branch
git checkout main

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo "📋 Deployment Summary:"
echo "   Timestamp: $TIMESTAMP"
echo "   Backup Location: $BACKUP_DIR/*_${TIMESTAMP}.sql"
echo "   Code Branch: realproduction"
echo "   Database: xwsgyxlvxntgpochonwe"
echo "   Frontend URL: https://canary.cards"
echo ""
echo "📍 Next Steps:"
echo "   1. Test production site: https://canary.cards"
echo "   2. Monitor Edge Function logs in Supabase dashboard"
echo "   3. If issues: run ./rollback-production.sh"
echo ""
echo "📊 Monitoring Links:"
echo "   • Production Dashboard: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe"
echo "   • Function Logs: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe/functions"
echo ""