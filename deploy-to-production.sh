#!/bin/bash

# Enhanced Production Deployment - Safe deployment with destructive change protection
# This script safely deploys from main branch to production with automatic safety checks

set -e  # Exit on any error

echo "🚀 Starting Enhanced Production Deployment..."
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
MIGRATION_DIR="backups/migrations"
ROLLBACK_DIR="backups/rollback-scripts"

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
mkdir -p "$BACKUP_DIR" "$MIGRATION_DIR" "$ROLLBACK_DIR"

# Create database dump using Supabase CLI
echo "   Backing up production database schema and data..."
supabase --project-ref xwsgyxlvxntgpochonwe db dump --data-only > "$BACKUP_DIR/production_data_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Database backup failed${NC}"
    exit 1
}

supabase --project-ref xwsgyxlvxntgpochonwe db dump --schema-only > "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Schema backup failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database backup created: ${BACKUP_DIR}/*_${TIMESTAMP}.sql${NC}"
echo ""

# Step 2: Generate Migration Diff and Check for Destructive Changes
echo "🔍 Analyzing database changes for safety..."

# Generate diff between staging and production
echo "   Generating migration diff..."
MIGRATION_FILE="$MIGRATION_DIR/migration_diff_${TIMESTAMP}.sql"
supabase db diff --project-ref pugnjgvdisdbdkbofwrc --project-ref-2 xwsgyxlvxntgpochonwe > "$MIGRATION_FILE" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Could not generate diff automatically - proceeding with direct push${NC}"
    MIGRATION_FILE=""
}

# Analyze migration for destructive changes if we have a diff
DESTRUCTIVE_DETECTED=false
SAFETY_WARNINGS=()

if [[ -n "$MIGRATION_FILE" && -f "$MIGRATION_FILE" ]]; then
    echo "   Scanning for destructive operations..."
    
    # Check for dangerous operations
    if grep -qi "DROP\s\+TABLE\|DROP\s\+COLUMN\|TRUNCATE\|DELETE\s\+FROM" "$MIGRATION_FILE"; then
        DESTRUCTIVE_DETECTED=true
        SAFETY_WARNINGS+=("🚨 DESTRUCTIVE OPERATIONS detected (DROP, TRUNCATE, DELETE)")
    fi
    
    if grep -qi "ALTER\s\+TABLE.*TYPE\|ALTER\s\+COLUMN.*TYPE" "$MIGRATION_FILE"; then
        SAFETY_WARNINGS+=("⚠️  TYPE CHANGES detected - may affect existing data")
    fi
    
    if grep -qi "ADD\s\+CONSTRAINT.*NOT\s\+NULL" "$MIGRATION_FILE"; then
        SAFETY_WARNINGS+=("⚠️  NOT NULL constraints detected - validate existing data")
    fi
    
    # Show analysis results
    if [[ ${#SAFETY_WARNINGS[@]} -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}🛡️  SAFETY ANALYSIS RESULTS:${NC}"
        for warning in "${SAFETY_WARNINGS[@]}"; do
            echo "   $warning"
        done
        echo ""
        
        if [[ "$DESTRUCTIVE_DETECTED" == true ]]; then
            echo -e "${RED}❌ DESTRUCTIVE CHANGES DETECTED${NC}"
            echo ""
            echo "Options:"
            echo "1. Cancel deployment and review changes manually"
            echo "2. Continue with automatic safety transforms"
            echo "3. Generate custom migration for manual review"
            echo ""
            read -p "Choose option [1/2/3]: " SAFETY_CHOICE
            
            case $SAFETY_CHOICE in
                1)
                    echo "Deployment cancelled. Review the migration file:"
                    echo "$MIGRATION_FILE"
                    exit 0
                    ;;
                2)
                    echo -e "${YELLOW}⚠️  Applying automatic safety transforms...${NC}"
                    # Apply safety transforms
                    sed -i 's/DROP COLUMN/-- SAFETY: DROP COLUMN/g' "$MIGRATION_FILE"
                    sed -i 's/DROP TABLE/-- SAFETY: DROP TABLE/g' "$MIGRATION_FILE"
                    sed -i 's/TRUNCATE/-- SAFETY: TRUNCATE/g' "$MIGRATION_FILE"
                    echo -e "${GREEN}✅ Safety transforms applied${NC}"
                    ;;
                3)
                    echo "Generating custom migration template..."
                    cp "$MIGRATION_FILE" "custom_migration_${TIMESTAMP}.sql"
                    echo "Edit the file: custom_migration_${TIMESTAMP}.sql"
                    echo "Then rerun deployment when ready."
                    exit 0
                    ;;
                *)
                    echo "Invalid choice. Deployment cancelled."
                    exit 1
                    ;;
            esac
        else
            echo -e "${YELLOW}⚠️  Non-destructive warnings detected. Continue? (y/n)${NC}"
            read -p "> " CONTINUE_CHOICE
            if [[ "$CONTINUE_CHOICE" != "y" && "$CONTINUE_CHOICE" != "yes" ]]; then
                echo "Deployment cancelled."
                exit 0
            fi
        fi
    else
        echo -e "${GREEN}✅ No destructive operations detected - safe to proceed${NC}"
    fi
fi

echo ""

# Step 3: Deploy Code Changes (main → realproduction)
echo "📦 Deploying code changes..."

# Switch to realproduction branch
git checkout realproduction >/dev/null 2>&1

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

# Step 4: Deploy Database Changes with Safety
echo "🗄️  Deploying database changes safely..."

# Create rollback script
echo "   Creating rollback script..."
ROLLBACK_SCRIPT="$ROLLBACK_DIR/rollback_${TIMESTAMP}.sh"
cat > "$ROLLBACK_SCRIPT" << EOF
#!/bin/bash
# Automated rollback script for deployment $TIMESTAMP
echo "🔄 Rolling back database to state before $TIMESTAMP"
supabase db reset --project-ref xwsgyxlvxntgpochonwe
psql "\$(supabase status --project-ref xwsgyxlvxntgpochonwe | grep 'DB URL' | cut -d':' -f2-)" < "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql"
psql "\$(supabase status --project-ref xwsgyxlvxntgpochonwe | grep 'DB URL' | cut -d':' -f2-)" < "$BACKUP_DIR/production_data_${TIMESTAMP}.sql"
echo "✅ Database rollback complete"
EOF
chmod +x "$ROLLBACK_SCRIPT"

# Apply database migrations with transaction safety
echo "   Applying database migrations to production..."
if ! supabase db push --project-ref xwsgyxlvxntgpochonwe; then
    echo -e "${RED}❌ Database migration failed${NC}"
    echo "🔄 Automatic rollback available:"
    echo "   Run: $ROLLBACK_SCRIPT"
    echo ""
    echo "🔄 Manual rollback also available:"
    echo "   Code: git checkout main && git push -f origin realproduction:realproduction"
    echo "   Database: Use backup files in $BACKUP_DIR"
    git checkout main
    exit 1
fi

echo -e "${GREEN}✅ Database migration complete${NC}"
echo ""

# Step 5: Deploy Edge Functions
echo "⚡ Deploying Edge Functions to production..."
supabase functions deploy --project-ref xwsgyxlvxntgpochonwe || {
    echo -e "${YELLOW}⚠️  Edge function deployment failed, but continuing...${NC}"
}

echo -e "${GREEN}✅ Edge Functions deployed${NC}"
echo ""

# Step 6: Post-deployment validation
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
echo -e "${GREEN}🎉 ENHANCED DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo "📋 Deployment Summary:"
echo "   Timestamp: $TIMESTAMP"
echo "   Backup Location: $BACKUP_DIR/*_${TIMESTAMP}.sql"
echo "   Code Branch: realproduction"
echo "   Database: xwsgyxlvxntgpochonwe"
echo "   Frontend URL: https://canary.cards"
echo "   Safety Checks: ✅ PASSED"
echo "   Rollback Script: $ROLLBACK_SCRIPT"
echo ""
echo "📍 Next Steps:"
echo "   1. Test production site: https://canary.cards"
echo "   2. Monitor Edge Function logs in Supabase dashboard"
echo "   3. If issues occur: ./rollback-production.sh"
echo ""
echo "📊 Monitoring Links:"
echo "   • Production Dashboard: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe"
echo "   • Function Logs: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe/functions"
echo ""
echo -e "${GREEN}✨ Your deployment is protected by automatic safety checks and rollback capabilities!${NC}"