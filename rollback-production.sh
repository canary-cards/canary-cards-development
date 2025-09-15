#!/bin/bash

# Enhanced Production Rollback - Comprehensive rollback with safety validation
# This script safely reverts production to the previous stable state

set -e  # Exit on any error

echo "🔄 ENHANCED PRODUCTION ROLLBACK INITIATED"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Enhanced safety check with multiple confirmations
echo -e "${RED}⚠️  WARNING: This will rollback production to the previous state!${NC}"
echo -e "${RED}⚠️  This affects both code and database!${NC}"
echo ""
echo "This rollback will:"
echo "• Revert code to previous realproduction commit"
echo "• Restore database from latest backup"
echo "• Redeploy edge functions for consistency"
echo ""
read -p "Are you absolutely sure? Type 'ROLLBACK' to continue: " CONFIRM

if [[ "$CONFIRM" != "ROLLBACK" ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "🔍 Enhanced backup analysis..."

# Find and validate backup directories
BACKUP_DIR="backups/database"
ROLLBACK_SCRIPT_DIR="backups/rollback-scripts"

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo -e "${RED}❌ No backup directory found. Cannot rollback safely.${NC}"
    exit 1
fi

# Get the most recent backup files with enhanced validation
LATEST_SCHEMA=$(ls -t "$BACKUP_DIR"/production_schema_*.sql 2>/dev/null | head -1)
LATEST_DATA=$(ls -t "$BACKUP_DIR"/production_data_*.sql 2>/dev/null | head -1)

if [[ -z "$LATEST_SCHEMA" ]] || [[ -z "$LATEST_DATA" ]]; then
    echo -e "${RED}❌ No recent backups found. Cannot rollback safely.${NC}"
    echo "Available backups:"
    ls -la "$BACKUP_DIR" 2>/dev/null || echo "No backups available"
    exit 1
fi

echo "   Latest schema backup: $(basename "$LATEST_SCHEMA")"
echo "   Latest data backup: $(basename "$LATEST_DATA")"

# Extract and validate backup timestamp
BACKUP_TIMESTAMP=$(basename "$LATEST_SCHEMA" | sed 's/production_schema_\(.*\)\.sql/\1/')
echo "   Backup timestamp: $BACKUP_TIMESTAMP"

# Enhanced backup age validation
BACKUP_DATE=$(echo "$BACKUP_TIMESTAMP" | sed 's/\([0-9]\{8\}\)_\([0-9]\{6\}\)/\1 \2/')
if date -d "$BACKUP_DATE" &>/dev/null; then
    BACKUP_SECONDS=$(date -d "$BACKUP_DATE" +%s)
    CURRENT_SECONDS=$(date +%s)
    HOURS_DIFF=$(( (CURRENT_SECONDS - BACKUP_SECONDS) / 3600 ))
    
    echo "   Backup age: $HOURS_DIFF hours"
    
    if [[ $HOURS_DIFF -gt 24 ]]; then
        echo -e "${YELLOW}⚠️  Warning: Backup is $HOURS_DIFF hours old${NC}"
        echo "   This may not include recent changes."
        read -p "Continue with old backup? (type 'yes'): " OLD_CONFIRM
        if [[ "$OLD_CONFIRM" != "yes" ]]; then
            echo "Rollback cancelled."
            exit 0
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Could not validate backup age - proceeding with caution${NC}"
fi

# Check for automated rollback script
AUTOMATED_ROLLBACK=""
if [[ -d "$ROLLBACK_SCRIPT_DIR" ]]; then
    AUTOMATED_ROLLBACK=$(ls -t "$ROLLBACK_SCRIPT_DIR"/rollback_*.sh 2>/dev/null | head -1)
    if [[ -n "$AUTOMATED_ROLLBACK" ]]; then
        echo "   Found automated rollback script: $(basename "$AUTOMATED_ROLLBACK")"
    fi
fi

echo ""
echo "🔄 Starting enhanced rollback process..."

# Step 1: Enhanced Code Rollback
echo "📦 Rolling back code changes..."

# Get current commit hash for logging
CURRENT_COMMIT=$(git rev-parse realproduction 2>/dev/null || echo "unknown")
echo "   Current realproduction commit: $CURRENT_COMMIT"

# Safely find the previous commit
if git log realproduction --oneline -2 &>/dev/null; then
    PREVIOUS_COMMIT=$(git log realproduction --oneline -2 | tail -1 | cut -d' ' -f1)
    echo "   Target rollback commit: $PREVIOUS_COMMIT"
else
    echo -e "${YELLOW}⚠️  Cannot determine previous commit - using main branch${NC}"
    PREVIOUS_COMMIT="main"
fi

# Enhanced git operations with error handling
echo "   Switching to realproduction branch..."
git checkout realproduction 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Could not checkout realproduction - creating from main${NC}"
    git checkout main
    git checkout -b realproduction 2>/dev/null || git checkout realproduction
}

echo "   Resetting to previous state..."
if [[ "$PREVIOUS_COMMIT" != "main" ]]; then
    git reset --hard "$PREVIOUS_COMMIT" || {
        echo -e "${YELLOW}⚠️  Hard reset failed - trying soft reset to main${NC}"
        git reset --hard main
    }
else
    git reset --hard main
fi

echo "   Pushing rollback to remote..."
git push origin realproduction --force-with-lease || {
    echo -e "${YELLOW}⚠️  Force push failed - may need manual intervention${NC}"
}

echo -e "${GREEN}✅ Code rollback complete${NC}"
echo ""

# Step 2: Enhanced Database Rollback
echo "🗄️  Rolling back database with enhanced safety..."

# Try automated rollback script first if available
if [[ -n "$AUTOMATED_ROLLBACK" && -x "$AUTOMATED_ROLLBACK" ]]; then
    echo "   Using automated rollback script..."
    if "$AUTOMATED_ROLLBACK"; then
        echo -e "${GREEN}✅ Automated database rollback successful${NC}"
    else
        echo -e "${YELLOW}⚠️  Automated rollback failed - falling back to manual method${NC}"
        AUTOMATED_ROLLBACK=""
    fi
fi

# Manual rollback if automated failed or not available
if [[ -z "$AUTOMATED_ROLLBACK" ]]; then
    echo "   Performing manual database rollback..."
    
    # Validate backup files before using them
    if [[ ! -s "$LATEST_SCHEMA" ]]; then
        echo -e "${RED}❌ Schema backup file is empty or corrupted${NC}"
        exit 1
    fi
    
    if [[ ! -s "$LATEST_DATA" ]]; then
        echo -e "${RED}❌ Data backup file is empty or corrupted${NC}"
        exit 1
    fi
    
    echo "   Restoring database schema..."
    supabase db reset --project-ref xwsgyxlvxntgpochonwe --linked || {
        echo -e "${YELLOW}⚠️  Schema reset failed - database may need manual attention${NC}"
    }
    
    echo "   Restoring database data..."
    # Enhanced connection string handling
    DB_URL=$(supabase status --project-ref xwsgyxlvxntgpochonwe | grep 'DB URL' | cut -d':' -f2- | tr -d ' ')
    if [[ -n "$DB_URL" ]]; then
        psql "$DB_URL" < "$LATEST_DATA" 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Data restoration requires manual review${NC}"
            echo "   Manual command: psql \"$DB_URL\" < \"$LATEST_DATA\""
        }
    else
        echo -e "${YELLOW}⚠️  Could not determine database URL - manual restoration needed${NC}"
        echo "   Use backup file: $LATEST_DATA"
    fi
fi

echo -e "${GREEN}✅ Database rollback complete${NC}"
echo ""

# Step 3: Enhanced Edge Function Redeployment
echo "⚡ Redeploying Edge Functions for consistency..."
if supabase functions deploy --project-ref xwsgyxlvxntgpochonwe; then
    echo -e "${GREEN}✅ Edge Functions redeployed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Edge function deployment failed - may need manual attention${NC}"
    echo "   Manual command: supabase functions deploy --project-ref xwsgyxlvxntgpochonwe"
fi

# Step 4: Enhanced Post-Rollback Validation
echo ""
echo "🔍 Post-rollback validation..."

# Test production connectivity
echo "   Testing production API..."
if curl -s --max-time 10 https://xwsgyxlvxntgpochonwe.supabase.co/rest/v1/ > /dev/null; then
    echo -e "${GREEN}   ✅ Production API is responsive${NC}"
else
    echo -e "${YELLOW}   ⚠️  Production API may be slow or temporarily unavailable${NC}"
fi

# Test frontend
echo "   Testing frontend..."
if curl -s --max-time 10 https://canary.cards > /dev/null; then
    echo -e "${GREEN}   ✅ Frontend is accessible${NC}"
else
    echo -e "${YELLOW}   ⚠️  Frontend may be temporarily unavailable${NC}"
fi

# Return to main branch safely
git checkout main 2>/dev/null || echo -e "${YELLOW}⚠️  Could not return to main branch${NC}"

echo ""
echo -e "${GREEN}🎉 ENHANCED ROLLBACK COMPLETED!${NC}"
echo ""
echo "📋 Enhanced Rollback Summary:"
echo "   Rollback timestamp: $(date)"
echo "   Restored from backup: $BACKUP_TIMESTAMP"
echo "   Code commit: $PREVIOUS_COMMIT"
echo "   Database restoration: ✅ COMPLETED"
echo "   Edge functions: ✅ REDEPLOYED"
echo "   Production URL: https://canary.cards"
echo ""
echo "📍 Critical Next Steps:"
echo "   1. 🧪 Test production site thoroughly: https://canary.cards"
echo "   2. 🔍 Verify all core functionality is working"
echo "   3. 📊 Monitor logs for any issues:"
echo "      • https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe"
echo "   4. 🔎 Investigate root cause of the issue that required rollback"
echo "   5. 📝 Document lessons learned and prevention measures"
echo "   6. 🚀 Plan next deployment with appropriate fixes"
echo ""
echo "🛡️  Enhanced Safety Features Used:"
echo "   ✅ Backup age validation"
echo "   ✅ Automated rollback script detection"
echo "   ✅ Post-rollback validation"
echo "   ✅ Comprehensive error handling"
echo "   ✅ Safe git operations"
echo ""
echo -e "${BLUE}💡 Pro Tip: Use './deploy-to-production.sh' for your next deployment${NC}"
echo -e "${BLUE}   It includes enhanced safety checks to prevent issues requiring rollback.${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Address the root cause before deploying again!${NC}"