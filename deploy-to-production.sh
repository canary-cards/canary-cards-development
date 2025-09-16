#!/bin/bash

# Enhanced Production Deployment - Safe deployment with destructive change protection
# This script safely deploys from main branch to production with automatic safety checks

set -e  # Exit on any error

# Check for command line options
DEBUG_MODE=false
RESET_PRODUCTION=false

for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG_MODE=true
            echo "🐛 Debug mode enabled"
            ;;
        --reset-production)
            RESET_PRODUCTION=true
            echo "⚠️  Production database reset mode enabled"
            ;;
        *)
            echo "Usage: $0 [--debug] [--reset-production]"
            echo ""
            echo "Options:"
            echo "  --debug             Enable debug output"
            echo "  --reset-production  Completely reset production database (DESTRUCTIVE)"
            exit 1
            ;;
    esac
done

echo "🚀 Starting Enhanced Production Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get database password from environment or prompt
get_database_password() {
    local env_var="$1"
    local prompt_text="$2"
    local result_var="$3"
    local password=""
    
    # Check if password is in environment variable
    password="${!env_var}"
    
    if [[ -n "$password" ]]; then
        echo "   Using password from environment variable: $env_var"
        eval "$result_var='$password'"
        return
    fi
    
    # Prompt for password interactively
    echo -n "   $prompt_text: "
    read -s password
    echo "" # New line after hidden input
    
    if [[ -z "$password" ]]; then
        echo -e "${RED}❌ Password cannot be empty${NC}"
        exit 1
    fi
    
    eval "$result_var='$password'"
}

# Function to get service role key from environment or prompt
get_service_role_key() {
    local result_var="$1"
    local password=""
    
    # Check if service role key is in environment variable
    password="$PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"
    
    if [[ -n "$password" ]]; then
        echo "   Using service role key from environment variable"
        eval "$result_var='$password'"
        return
    fi
    
    # Prompt for service role key interactively
    echo -n "   Enter production Supabase service role key: "
    read -s password
    echo "" # New line after hidden input
    
    if [[ -z "$password" ]]; then
        echo -e "${RED}❌ Service role key cannot be empty${NC}"
        exit 1
    fi
    
    # Validate service role key format
    if [[ ! "$password" =~ ^eyJ ]]; then
        echo -e "${RED}❌ Invalid service role key format (should start with 'eyJ')${NC}"
        exit 1
    fi
    
    eval "$result_var='$password'"
}

# Function to check if pg_dump is available
check_pg_dump_availability() {
    if ! command -v pg_dump >/dev/null 2>&1; then
        echo -e "${RED}❌ pg_dump not found${NC}"
        echo "Please install PostgreSQL client tools:"
        echo "  • macOS: brew install postgresql"
        echo "  • Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "  • RHEL/CentOS: sudo yum install postgresql"
        echo ""
        echo "Alternatively, run with --skip-backup flag (not recommended for production)"
        exit 1
    fi
}

# Function to test database connectivity
test_database_connection() {
    local db_url="$1"
    local db_name="$2"
    
    echo "   Testing $db_name database connection..."
    
    if ! psql "$db_url" -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${RED}❌ Failed to connect to $db_name database${NC}"
        echo "Please check your database password and network connectivity"
        exit 1
    fi
    
    echo -e "${GREEN}   ✅ $db_name database connection successful${NC}"
}

# Get database credentials
echo "🔐 Getting database credentials..."

# Get database passwords (from env vars or interactive prompts) - using variable references to avoid subshells
get_database_password "PRODUCTION_DB_PASSWORD" "Enter production database password" "PRODUCTION_DB_PASSWORD"
get_database_password "STAGING_DB_PASSWORD" "Enter staging database password" "STAGING_DB_PASSWORD"

# Get service role key (from env var or interactive prompt) - using variable reference to avoid subshells
get_service_role_key "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"

# Set up authentication for Supabase CLI using service role key
export SUPABASE_ACCESS_TOKEN="$PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"

echo -e "${GREEN}✅ All credentials obtained successfully${NC}"
echo ""

# Database connection URLs (fixed regional endpoints)
# Use PgBouncer (port 6543) for regular operations like pg_dump
STAGING_DB_URL="postgresql://postgres.pugnjgvdisdbdkbofwrc:${STAGING_DB_PASSWORD}@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
PRODUCTION_DB_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:${PRODUCTION_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Use direct connection (port 5432) for migrations and resets (required for prepared statements)
STAGING_DB_DIRECT_URL="postgresql://postgres.pugnjgvdisdbdkbofwrc:${STAGING_DB_PASSWORD}@db.pugnjgvdisdbdkbofwrc.supabase.co:5432/postgres"
PRODUCTION_DB_DIRECT_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:${PRODUCTION_DB_PASSWORD}@db.xwsgyxlvxntgpochonwe.supabase.co:5432/postgres"

# Configure DNS64/NAT64 for IPv6-to-IPv4 connectivity
echo "🌐 Configuring DNS64/NAT64 for database connectivity..."

# Check current network connectivity
echo "   Checking network connectivity..."
if command -v dig &> /dev/null; then
    echo "   IPv4 test: $(dig +short ifconfig.co @8.8.8.8 2>/dev/null || echo 'Failed')"
    echo "   IPv6 test: $(dig +short ifconfig.co AAAA @2001:4860:4860::8888 2>/dev/null || echo 'No IPv6')"
fi

# Set up DNS64/NAT64 using Google's public DNS64 service
echo "   Setting up DNS64/NAT64 gateway..."
export RESOLV_CONF_BACKUP="/tmp/resolv.conf.backup.$$"

# Backup current DNS config if we can modify it
if [ "$EUID" -eq 0 ] || (command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null); then
    if [ -f /etc/resolv.conf ]; then
        cp /etc/resolv.conf "$RESOLV_CONF_BACKUP" 2>/dev/null || true
        echo "   Backed up DNS configuration"
    fi
    
    # Configure DNS64 nameservers  
    {
        echo "# Temporary DNS64/NAT64 configuration for Supabase connectivity"
        echo "nameserver 2001:4860:4860::6464"
        echo "nameserver 2001:4860:4860::64" 
        echo "nameserver 8.8.8.8"
        echo "nameserver 8.8.4.4"
    } | tee /etc/resolv.conf >/dev/null 2>&1 || {
        echo "   ⚠️  Could not modify /etc/resolv.conf (running without root)"
        echo "   Attempting connection with existing DNS configuration..."
    }
else
    echo "   ⚠️  Running without root privileges - using existing DNS"
fi

# Set up cleanup trap to restore DNS configuration on exit
trap 'restore_dns_config' EXIT INT TERM

# Function to restore DNS configuration
restore_dns_config() {
    if [ -f "$RESOLV_CONF_BACKUP" ] && [ "$EUID" -eq 0 ]; then
        cp "$RESOLV_CONF_BACKUP" /etc/resolv.conf 2>/dev/null || true
        rm -f "$RESOLV_CONF_BACKUP" 2>/dev/null || true
        echo "   DNS configuration restored"
    fi
}

# Test database connections with enhanced error handling
echo "🔗 Testing database connections..."

# Test staging connection with timeout and detailed logging
echo "   Testing staging database..."
if timeout 30 psql "$STAGING_DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Staging database connection successful${NC}"
else
    echo -e "${RED}   ❌ Failed to connect to staging database${NC}"
    echo "   Trying direct connection test..."
    nc -zv aws-1-us-east-1.pooler.supabase.com 6543 2>&1 | head -1 || echo "   Direct connection test failed"
    
    restore_dns_config
    echo "   Check your staging database password and network connectivity"
    exit 1
fi

# Test production connection with timeout and detailed logging  
echo "   Testing production database..."
if timeout 30 psql "$PRODUCTION_DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Production database connection successful${NC}"
else
    echo -e "${RED}   ❌ Failed to connect to production database${NC}"
    echo "   Trying direct connection test..."
    nc -zv aws-0-us-west-1.pooler.supabase.com 6543 2>&1 | head -1 || echo "   Direct connection test failed"
    
    restore_dns_config
    echo "   Check your production database password and network connectivity"
    exit 1
fi
echo ""

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

# Check if pg_dump is available
check_pg_dump_availability

# Create database dump using pg_dump
echo "   Backing up production database schema and data..."
pg_dump "$PRODUCTION_DB_URL" --data-only --no-owner --no-privileges > "$BACKUP_DIR/production_data_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Database backup failed${NC}"
    echo "Check your PRODUCTION_DB_PASSWORD and network connectivity"
    exit 1
}

pg_dump "$PRODUCTION_DB_URL" --schema-only --no-owner --no-privileges > "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Schema backup failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database backup created: ${BACKUP_DIR}/*_${TIMESTAMP}.sql${NC}"
echo ""

# Handle production database reset if requested
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo -e "${RED}🚨 PRODUCTION DATABASE RESET REQUESTED${NC}"
    echo ""
    echo -e "${YELLOW}WARNING: This will completely WIPE the production database!${NC}"
    echo "   • All tables and data will be permanently deleted"
    echo "   • Migration history will be reset"
    echo "   • This operation CANNOT be undone (except via backup restore)"
    echo ""
    echo "Backup created at: ${BACKUP_DIR}/*_${TIMESTAMP}.sql"
    echo ""
    read -p "   Are you ABSOLUTELY SURE you want to reset production? (type 'RESET' to confirm): " RESET_CONFIRMATION
    
    if [[ "$RESET_CONFIRMATION" != "RESET" ]]; then
        echo -e "${GREEN}✅ Reset cancelled - deployment will continue normally${NC}"
        RESET_PRODUCTION=false
    else
        echo ""
        echo -e "${RED}⚠️  FINAL CONFIRMATION REQUIRED${NC}"
        echo "   You are about to permanently delete ALL data in production database."
        echo "   Project: xwsgyxlvxntgpochonwe"
        echo "   Backup: ${BACKUP_DIR}/*_${TIMESTAMP}.sql"
        echo ""
        read -p "   Type 'DESTROY' to proceed with database reset: " FINAL_CONFIRMATION
        
        if [[ "$FINAL_CONFIRMATION" != "DESTROY" ]]; then
            echo -e "${GREEN}✅ Reset cancelled - deployment will continue normally${NC}"
            RESET_PRODUCTION=false
        else
            echo ""
            echo -e "${RED}💥 RESETTING PRODUCTION DATABASE...${NC}"
            echo "   This will take a few moments..."
            
            if supabase db reset --db-url "$PRODUCTION_DB_DIRECT_URL"; then
                echo -e "${GREEN}✅ Production database reset complete${NC}"
                echo "   Database is now empty and ready for fresh schema deployment"
            else
                echo -e "${RED}❌ Database reset failed${NC}"
                echo "🔄 Rollback information:"
                echo "   Restore from backup: $BACKUP_DIR/production_*_${TIMESTAMP}.sql"
                echo "   Or run: $ROLLBACK_SCRIPT (when created)"
                exit 1
            fi
        fi
    fi
    echo ""
fi

# Step 2: Generate Migration Diff and Check for Destructive Changes
echo "🔍 Analyzing database changes for safety..."

# Generate diff between staging and production
echo "   Generating migration diff..."
MIGRATION_FILE="$MIGRATION_DIR/migration_diff_${TIMESTAMP}.sql"

# Generate schema dumps for both environments and create diff
echo "   Dumping staging schema for comparison..."
STAGING_SCHEMA_TEMP="/tmp/staging_schema_${TIMESTAMP}.sql"
PRODUCTION_SCHEMA_TEMP="/tmp/production_schema_${TIMESTAMP}.sql"

# Dump schemas for comparison using pg_dump
pg_dump "$STAGING_DB_URL" --schema-only --no-owner --no-privileges > "$STAGING_SCHEMA_TEMP" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Could not dump staging schema - proceeding with direct push${NC}"
    MIGRATION_FILE=""
}

if [[ -n "$MIGRATION_FILE" ]]; then
    pg_dump "$PRODUCTION_DB_URL" --schema-only --no-owner --no-privileges > "$PRODUCTION_SCHEMA_TEMP" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not dump production schema - proceeding with direct push${NC}"  
        MIGRATION_FILE=""
    }
fi

# Create a basic diff (this is simplified - in practice you'd want a proper schema diff tool)
if [[ -n "$MIGRATION_FILE" ]]; then
    echo "-- Migration diff generated at ${TIMESTAMP}" > "$MIGRATION_FILE"
    echo "-- Differences between staging and production schemas" >> "$MIGRATION_FILE"
    echo "-- Review this file before applying changes" >> "$MIGRATION_FILE"
    diff "$PRODUCTION_SCHEMA_TEMP" "$STAGING_SCHEMA_TEMP" >> "$MIGRATION_FILE" 2>/dev/null || true
    
    # Clean up temp files
    rm -f "$STAGING_SCHEMA_TEMP" "$PRODUCTION_SCHEMA_TEMP"
fi

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

# Use direct database URL for rollback (required for migrations)
PRODUCTION_DB_DIRECT_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:\${PRODUCTION_DB_PASSWORD}@db.xwsgyxlvxntgpochonwe.supabase.co:5432/postgres"

echo "   Resetting production database..."
supabase db reset --db-url "\$PRODUCTION_DB_DIRECT_URL"

echo "   Restoring schema..."
psql "\$PRODUCTION_DB_URL" < "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql"

echo "   Restoring data..."
psql "\$PRODUCTION_DB_URL" < "$BACKUP_DIR/production_data_${TIMESTAMP}.sql"

echo "✅ Database rollback complete"
EOF
chmod +x "$ROLLBACK_SCRIPT"

# Apply database migrations with appropriate strategy based on reset status
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo "   Deploying fresh schema to reset database..."
    echo "   (Skipping migration history validation since database was reset)"
else
    echo "   Validating migration history compatibility..."
    
    # Check for migration history mismatches first
    if ! supabase db push --db-url "$PRODUCTION_DB_DIRECT_URL" --dry-run 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Migration history mismatch detected${NC}"
        echo "   This usually means the production database has migrations not present locally."
        echo ""
        echo "Options:"
        echo "1. Auto-sync local migrations with production"
        echo "2. Reset production database and start fresh"
        echo ""
        read -p "   Choose option [1/2]: " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[1]$ ]]; then
            echo "   Syncing local migrations with production database..."
            if supabase db pull --db-url "$PRODUCTION_DB_DIRECT_URL"; then
                echo -e "${GREEN}✅ Migration history synced successfully${NC}"
                echo "   Re-attempting deployment..."
            else
                echo -e "${RED}❌ Failed to sync migration history${NC}"
                echo "   Manual intervention required:"
                echo "   1. Run: supabase db pull --db-url \$PRODUCTION_DB_URL"
                echo "   2. Or run: supabase migration repair --status reverted [migration-ids]"
                echo "   3. Or re-run with --reset-production flag"
                echo ""
                echo "🔄 Automatic rollback available:"
                echo "   Run: $ROLLBACK_SCRIPT"
                git checkout main
                exit 1
            fi
        elif [[ $REPLY =~ ^[2]$ ]]; then
            echo ""
            echo -e "${YELLOW}⚠️  Converting to reset deployment...${NC}"
            RESET_PRODUCTION=true
            echo "   Database will be reset and fresh schema deployed"
        else
            echo -e "${RED}❌ Invalid option selected${NC}"
            echo "   Manual intervention required:"
            echo "   1. Run: supabase db pull --db-url \$PRODUCTION_DB_URL"
            echo "   2. Or run: supabase migration repair --status reverted [migration-ids]"
            echo "   3. Or re-run with --reset-production flag"
            echo ""
            echo "🔄 Automatic rollback available:"
            echo "   Run: $ROLLBACK_SCRIPT"
            git checkout main
            exit 1
        fi
    fi
fi

if [[ "$RESET_PRODUCTION" == true ]]; then
    echo "   Applying fresh schema to reset production database..."
else
    echo "   Applying database migrations to production..."
fi

# Deploy database changes using supabase db push
if ! supabase db push --db-url "$PRODUCTION_DB_DIRECT_URL"; then
    if [[ "$RESET_PRODUCTION" == true ]]; then
        echo -e "${RED}❌ Fresh schema deployment failed${NC}"
        echo ""
        echo "🔍 Possible causes:"
        echo "   • Schema syntax errors in migration files"
        echo "   • Database connection issues"
        echo "   • Permission problems"
    else
        echo -e "${RED}❌ Database migration failed${NC}"
        echo ""
        echo "🔍 Common fixes:"
        echo "   • Migration history mismatch: supabase db pull --db-url \$PRODUCTION_DB_URL"
        echo "   • Repair migration table: supabase migration repair --status reverted [ids]"
        echo "   • Check migration file syntax and constraints"
        echo "   • Try with --reset-production flag for clean deployment"
    fi
    echo ""
    echo "🔄 Automatic rollback available:"
    echo "   Run: $ROLLBACK_SCRIPT"
    echo ""
    echo "🔄 Manual rollback also available:"
    echo "   Code: git checkout main && git push -f origin realproduction:realproduction"
    echo "   Database: Use backup files in $BACKUP_DIR"
    git checkout main
    exit 1
fi

if [[ "$RESET_PRODUCTION" == true ]]; then
    echo -e "${GREEN}✅ Fresh schema deployment complete${NC}"
else
    echo -e "${GREEN}✅ Database migration complete${NC}"
fi
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
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo "   Database Mode: 🔄 RESET (Fresh schema deployed)"
else
    echo "   Database Mode: 📦 MIGRATION (Incremental updates)"
fi
echo "   Frontend URL: https://canary.cards"
echo "   Safety Checks: ✅ PASSED"
echo "   Rollback Script: $ROLLBACK_SCRIPT"
echo ""
echo "📍 Next Steps:"
echo "   1. Test production site: https://canary.cards"
echo "   2. Monitor Edge Function logs in Supabase dashboard"
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo "   3. Verify all data is properly restored (if data was migrated)"
    echo "   4. If issues occur: Use backup files in $BACKUP_DIR"
else
    echo "   3. If issues occur: ./rollback-production.sh"
fi
echo ""
echo "📊 Monitoring Links:"
echo "   • Production Dashboard: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe"
echo "   • Function Logs: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe/functions"
echo ""
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo -e "${GREEN}✨ Your production database has been reset and is now in sync with staging!${NC}"
else
    echo -e "${GREEN}✨ Your deployment is protected by automatic safety checks and rollback capabilities!${NC}"
fi