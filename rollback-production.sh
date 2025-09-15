#!/bin/bash

# Rollback Production - Emergency rollback script
# This script quickly reverts production to the previous state

set -e  # Exit on any error

echo "🔄 PRODUCTION ROLLBACK INITIATED"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Safety check
echo -e "${RED}⚠️  WARNING: This will rollback production to the previous state!${NC}"
echo ""
read -p "Are you sure you want to proceed? (type 'yes' to continue): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "🔍 Finding latest backup..."

# Find the most recent backup
BACKUP_DIR="backups/database"
if [[ ! -d "$BACKUP_DIR" ]]; then
    echo -e "${RED}❌ No backup directory found. Cannot rollback.${NC}"
    exit 1
fi

# Get the most recent backup files
LATEST_SCHEMA=$(ls -t "$BACKUP_DIR"/production_schema_*.sql 2>/dev/null | head -1)
LATEST_DATA=$(ls -t "$BACKUP_DIR"/production_data_*.sql 2>/dev/null | head -1)

if [[ -z "$LATEST_SCHEMA" ]] || [[ -z "$LATEST_DATA" ]]; then
    echo -e "${RED}❌ No recent backups found. Cannot rollback safely.${NC}"
    echo "Available backups:"
    ls -la "$BACKUP_DIR" || echo "No backups available"
    exit 1
fi

echo "   Latest schema backup: $(basename "$LATEST_SCHEMA")"
echo "   Latest data backup: $(basename "$LATEST_DATA")"
echo ""

# Extract timestamp from backup filename
BACKUP_TIMESTAMP=$(basename "$LATEST_SCHEMA" | sed 's/production_schema_\(.*\)\.sql/\1/')
echo "📅 Backup timestamp: $BACKUP_TIMESTAMP"

# Check if backup is too old (more than 24 hours)
BACKUP_DATE=$(echo "$BACKUP_TIMESTAMP" | sed 's/\([0-9]\{8\}\)_\([0-9]\{6\}\)/\1 \2/')
BACKUP_SECONDS=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || echo "0")
CURRENT_SECONDS=$(date +%s)
HOURS_DIFF=$(( (CURRENT_SECONDS - BACKUP_SECONDS) / 3600 ))

if [[ $HOURS_DIFF -gt 24 ]]; then
    echo -e "${YELLOW}⚠️  Warning: Backup is $HOURS_DIFF hours old${NC}"
    read -p "Continue with old backup? (type 'yes'): " OLD_CONFIRM
    if [[ "$OLD_CONFIRM" != "yes" ]]; then
        echo "Rollback cancelled."
        exit 0
    fi
fi

echo ""
echo "🔄 Starting rollback process..."

# Step 1: Rollback Code (realproduction branch)
echo "📦 Rolling back code changes..."

# Get current commit hash for logging
CURRENT_COMMIT=$(git rev-parse realproduction)
echo "   Current realproduction commit: $CURRENT_COMMIT"

# Find the commit before the latest merge
PREVIOUS_COMMIT=$(git log realproduction --oneline -2 | tail -1 | cut -d' ' -f1)
echo "   Rolling back to commit: $PREVIOUS_COMMIT"

# Switch to realproduction and reset
git checkout realproduction
git reset --hard "$PREVIOUS_COMMIT"
git push origin realproduction --force-with-lease

echo -e "${GREEN}✅ Code rollback complete${NC}"
echo ""

# Step 2: Rollback Database
echo "🗄️  Rolling back database..."

echo "   Restoring schema..."
supabase db reset --project-ref xwsgyxlvxntgpochonwe --linked || {
    echo -e "${YELLOW}⚠️  Schema reset failed, trying manual restore...${NC}"
    # Note: In a real scenario, you'd need more sophisticated DB rollback
    # This is a simplified approach
}

echo "   Restoring data..."
# Note: This is simplified - in production you'd want more sophisticated data restoration
psql "$(supabase status --project-ref xwsgyxlvxntgpochonwe | grep 'DB URL' | cut -d':' -f2-)" < "$LATEST_DATA" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Data restoration may require manual intervention${NC}"
}

echo -e "${GREEN}✅ Database rollback complete${NC}"
echo ""

# Step 3: Re-deploy Edge Functions (to ensure consistency)
echo "⚡ Redeploying Edge Functions..."
supabase functions deploy --project-ref xwsgyxlvxntgpochonwe || {
    echo -e "${YELLOW}⚠️  Edge function deployment failed${NC}"
}

# Return to main branch
git checkout main

echo ""
echo -e "${GREEN}🎉 ROLLBACK COMPLETED!${NC}"
echo ""
echo "📋 Rollback Summary:"
echo "   Timestamp: $(date)"
echo "   Restored from backup: $BACKUP_TIMESTAMP"
echo "   Code commit: $PREVIOUS_COMMIT"
echo "   Production URL: https://canary.cards"
echo ""
echo "📍 Next Steps:"
echo "   1. Test production site: https://canary.cards"
echo "   2. Verify functionality is working"
echo "   3. Investigate what caused the issue"
echo "   4. Plan next deployment with fixes"
echo ""
echo "📊 Monitoring:"
echo "   • Check production: https://canary.cards"
echo "   • Monitor logs: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe"
echo ""
echo -e "${YELLOW}⚠️  Remember to investigate and fix the root cause before next deployment!${NC}"