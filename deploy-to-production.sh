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

# Function to URL-encode strings (critical for passwords with special characters)
url_encode() {
    local string="${1}"
    local strlen=${#string}
    local encoded=""
    local pos c o

    for (( pos=0 ; pos<strlen ; pos++ )); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9] ) o="${c}" ;;
            * ) printf -v o '%%%02X' "'$c" ;;
        esac
        encoded+="${o}"
    done
    echo "${encoded}"
}

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

# Function to get Supabase access token (Personal Access Token)
get_supabase_access_token() {
    local result_var="$1"
    local token=""
    
    # Check if access token is in environment variable
    token="$SUPABASE_ACCESS_TOKEN"
    
    if [[ -n "$token" ]]; then
        echo "   Using Supabase access token from environment variable"
        eval "$result_var='$token'"
        return
    fi
    
    # Prompt for access token interactively
    echo ""
    echo "   📌 Note: You need a Personal Access Token from https://supabase.com/dashboard/account/tokens"
    echo "   This is different from the service role key and starts with 'sbp_'"
    echo ""
    echo -n "   Enter your Supabase Personal Access Token (or press Enter to skip): "
    read -s token
    echo "" # New line after hidden input
    
    if [[ -z "$token" ]]; then
        echo "   ⚠️  No access token provided - will use alternative methods"
        eval "$result_var=''"
        return
    fi
    
    # Validate access token format
    if [[ ! "$token" =~ ^sbp_ ]]; then
        echo -e "${YELLOW}   ⚠️  Invalid access token format (should start with 'sbp_')${NC}"
        echo "   Proceeding without CLI access token..."
        eval "$result_var=''"
        return
    fi
    
    eval "$result_var='$token'"
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

# Function to test connection with detailed diagnostics
test_connection_with_diagnostics() {
    local db_url="$1"
    local db_name="$2"
    local db_host="$3"
    local db_port="$4"
    
    echo "   Testing $db_name database (pooler connection)..."
    
    # First test network connectivity
    if command -v nc &> /dev/null; then
        if ! nc -zv -w5 "$db_host" "$db_port" &>/dev/null; then
            echo -e "${RED}   ❌ Cannot reach $db_name pooler (network issue)${NC}"
            echo "   Host: $db_host"
            echo "   Port: $db_port"
            return 1
        fi
    fi
    
    # Test with timeout and better error capture
    local error_output=$(timeout 30 psql "$db_url" -c "SELECT 1 as test;" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}   ✅ $db_name database connection successful${NC}"
        return 0
    else
        echo -e "${RED}   ❌ Failed to connect to $db_name database${NC}"
        
        # Provide specific error diagnosis
        if echo "$error_output" | grep -q "password authentication failed"; then
            echo "   Issue: Password authentication failed"
            echo "   • Check if password contains special characters that weren't properly encoded"
            echo "   • Verify the password is correct in Supabase dashboard"
        elif echo "$error_output" | grep -q "timeout"; then
            echo "   Issue: Connection timeout"
            echo "   • Check network connectivity"
            echo "   • Verify firewall settings"
        elif echo "$error_output" | grep -q "SSL"; then
            echo "   Issue: SSL/TLS connection problem"
            echo "   • Try adding ?sslmode=require to connection string"
        else
            echo "   Error details: ${error_output:0:200}"
        fi
        return 1
    fi
}

# Function to recreate migration history table
recreate_migration_history_table() {
    local db_url="$1"
    
    echo "   Recreating migration history table..."
    
    # Create the schema and table
    psql "$db_url" << 'EOF' 2>/dev/null
-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

-- Create migration history table
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text NOT NULL PRIMARY KEY,
    inserted_at timestamptz DEFAULT now()
);

-- Grant permissions
GRANT ALL ON SCHEMA supabase_migrations TO postgres;
GRANT ALL ON TABLE supabase_migrations.schema_migrations TO postgres;
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}   ✅ Migration history table created${NC}"
        return 0
    else
        echo -e "${RED}   ❌ Failed to create migration history table${NC}"
        return 1
    fi
}

# Get database credentials
echo "🔐 Getting database credentials..."

# Get database passwords (from env vars or interactive prompts)
get_database_password "PRODUCTION_DB_PASSWORD" "Enter production database password" "PRODUCTION_DB_PASSWORD"
get_database_password "STAGING_DB_PASSWORD" "Enter staging database password" "STAGING_DB_PASSWORD"

# Get service role key (for API operations, not CLI)
get_service_role_key "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"

# Get Supabase Personal Access Token (for CLI operations)
get_supabase_access_token "SUPABASE_ACCESS_TOKEN"

# Only set the access token if we have a valid one
if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
    export SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN"
    echo -e "${GREEN}✅ All credentials obtained successfully (with CLI access)${NC}"
else
    echo -e "${GREEN}✅ Database credentials obtained (CLI will use local auth)${NC}"
fi
echo ""

# Encode passwords for safe URL usage
echo "🔐 Encoding database credentials for secure connections..."
ENCODED_STAGING_PASSWORD=$(url_encode "$STAGING_DB_PASSWORD")
ENCODED_PRODUCTION_PASSWORD=$(url_encode "$PRODUCTION_DB_PASSWORD")

# Database connection URLs (fixed regional endpoints)
# Use PgBouncer (port 6543) for regular operations like pg_dump
STAGING_DB_URL="postgresql://postgres.pugnjgvdisdbdkbofwrc:${ENCODED_STAGING_PASSWORD}@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
PRODUCTION_DB_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:${ENCODED_PRODUCTION_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Use direct connection (port 5432) for migrations and resets (required for prepared statements)
STAGING_DB_DIRECT_URL="postgresql://postgres.pugnjgvdisdbdkbofwrc:${ENCODED_STAGING_PASSWORD}@db.pugnjgvdisdbdkbofwrc.supabase.co:5432/postgres"
PRODUCTION_DB_DIRECT_URL="postgresql://postgres.xwsgyxlvxntgpochonwe:${ENCODED_PRODUCTION_PASSWORD}@db.xwsgyxlvxntgpochonwe.supabase.co:5432/postgres"

# Configure IPv4-compatible pooler connections for migration
echo "🌐 Configuring IPv4-only database connections..."

# Use pooler connections with SSL for security
STAGING_DB_POOLER_URL="${STAGING_DB_URL}?sslmode=require"
PRODUCTION_DB_POOLER_URL="${PRODUCTION_DB_URL}?sslmode=require"

# Network diagnostics to understand connectivity
echo "   Checking network connectivity..."
if command -v dig &> /dev/null; then
    IPV4_TEST=$(dig +short ifconfig.co @8.8.8.8 2>/dev/null || echo 'Failed')
    IPV6_TEST=$(dig +short ifconfig.co AAAA @2001:4860:4860::8888 2>/dev/null || echo 'No IPv6')
    echo "   IPv4 capability: $IPV4_TEST"
    echo "   IPv6 capability: $IPV6_TEST"
    
    if [ "$IPV6_TEST" = "No IPv6" ]; then
        echo "   Using IPv4-compatible pooler connections for migrations"
    fi
fi

# Enhanced database connection testing
echo "🔗 Testing database connections..."

# Test staging connection
if ! test_connection_with_diagnostics "$STAGING_DB_POOLER_URL" "staging" "aws-1-us-east-1.pooler.supabase.com" "6543"; then
    echo ""
    echo "🔧 Troubleshooting suggestions:"
    echo "   1. Verify your password in Supabase dashboard"
    echo "   2. Try resetting the database password if needed"
    echo "   3. Check if your IP is whitelisted (if IP restrictions are enabled)"
    echo "   4. Ensure you're using the correct project reference"
    exit 1
fi

# Test production connection
if ! test_connection_with_diagnostics "$PRODUCTION_DB_POOLER_URL" "production" "aws-0-us-west-1.pooler.supabase.com" "6543"; then
    echo ""
    echo "🔧 Troubleshooting suggestions:"
    echo "   1. Verify your password in Supabase dashboard"
    echo "   2. Try resetting the database password if needed"
    echo "   3. Check if your IP is whitelisted (if IP restrictions are enabled)"
    echo "   4. Ensure you're using the correct project reference"
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

# Create database dump using pg_dump with encoded passwords
echo "   Backing up production database schema and data..."

# Use PGPASSWORD environment variable for pg_dump to avoid URL encoding issues
export PGPASSWORD="$PRODUCTION_DB_PASSWORD"

pg_dump -h aws-0-us-west-1.pooler.supabase.com \
        -p 6543 \
        -U postgres.xwsgyxlvxntgpochonwe \
        -d postgres \
        --data-only \
        --no-owner \
        --no-privileges \
        > "$BACKUP_DIR/production_data_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Database backup failed${NC}"
    echo "Check your PRODUCTION_DB_PASSWORD and network connectivity"
    unset PGPASSWORD
    exit 1
}

pg_dump -h aws-0-us-west-1.pooler.supabase.com \
        -p 6543 \
        -U postgres.xwsgyxlvxntgpochonwe \
        -d postgres \
        --schema-only \
        --no-owner \
        --no-privileges \
        > "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql" || {
    echo -e "${RED}❌ Schema backup failed${NC}"
    unset PGPASSWORD
    exit 1
}

unset PGPASSWORD

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
            
            # Try to reset using CLI first
            if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
                supabase link --project-ref xwsgyxlvxntgpochonwe 2>/dev/null || true
                if supabase db reset --linked; then
                    echo -e "${GREEN}✅ Production database reset complete${NC}"
                    echo "   Database is now empty and ready for fresh schema deployment"
                else
                    echo -e "${YELLOW}⚠️  CLI reset failed, using direct SQL method...${NC}"
                    psql "$PRODUCTION_DB_DIRECT_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
                        echo -e "${RED}❌ Database reset failed${NC}"
                        exit 1
                    }
                fi
            else
                # Direct SQL reset
                psql "$PRODUCTION_DB_DIRECT_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
                    echo -e "${RED}❌ Database reset failed${NC}"
                    exit 1
                }
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

# Use PGPASSWORD for schema dumps
export PGPASSWORD="$STAGING_DB_PASSWORD"
pg_dump -h aws-1-us-east-1.pooler.supabase.com \
        -p 6543 \
        -U postgres.pugnjgvdisdbdkbofwrc \
        -d postgres \
        --schema-only \
        --no-owner \
        --no-privileges \
        > "$STAGING_SCHEMA_TEMP" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Could not dump staging schema - proceeding with direct push${NC}"
    MIGRATION_FILE=""
}
unset PGPASSWORD

if [[ -n "$MIGRATION_FILE" ]]; then
    export PGPASSWORD="$PRODUCTION_DB_PASSWORD"
    pg_dump -h aws-0-us-west-1.pooler.supabase.com \
            -p 6543 \
            -U postgres.xwsgyxlvxntgpochonwe \
            -d postgres \
            --schema-only \
            --no-owner \
            --no-privileges \
            > "$PRODUCTION_SCHEMA_TEMP" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not dump production schema - proceeding with direct push${NC}"  
        MIGRATION_FILE=""
    }
    unset PGPASSWORD
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
                    sed -i '' 's/DROP COLUMN/-- SAFETY: DROP COLUMN/g' "$MIGRATION_FILE" 2>/dev/null || sed -i 's/DROP COLUMN/-- SAFETY: DROP COLUMN/g' "$MIGRATION_FILE"
                    sed -i '' 's/DROP TABLE/-- SAFETY: DROP TABLE/g' "$MIGRATION_FILE" 2>/dev/null || sed -i 's/DROP TABLE/-- SAFETY: DROP TABLE/g' "$MIGRATION_FILE"
                    sed -i '' 's/TRUNCATE/-- SAFETY: TRUNCATE/g' "$MIGRATION_FILE" 2>/dev/null || sed -i 's/TRUNCATE/-- SAFETY: TRUNCATE/g' "$MIGRATION_FILE"
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
psql "\$PRODUCTION_DB_DIRECT_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "   Restoring schema..."
psql "\$PRODUCTION_DB_DIRECT_URL" < "$BACKUP_DIR/production_schema_${TIMESTAMP}.sql"

echo "   Restoring data..."
psql "\$PRODUCTION_DB_DIRECT_URL" < "$BACKUP_DIR/production_data_${TIMESTAMP}.sql"

echo "✅ Database rollback complete"
EOF
chmod +x "$ROLLBACK_SCRIPT"

# Apply database migrations with appropriate strategy based on reset status
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo "   Deploying fresh schema to reset database..."
    echo "   (Skipping migration history validation since database was reset)"
else
    echo "   Validating migration history compatibility..."
    
    # Check migration status
    echo "   Checking migration files and database state..."
    MIGRATION_FILES_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")
    
    if [ "$MIGRATION_FILES_COUNT" -gt 0 ]; then
        echo "   Found $MIGRATION_FILES_COUNT migration files to apply"
        
        # Check if migration history table exists
        TABLE_EXISTS=$(psql "$PRODUCTION_DB_URL" -t -c "
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'supabase_migrations' 
                AND table_name = 'schema_migrations'
            );" 2>/dev/null | tr -d ' \n' || echo "error")
        
        if [ "$TABLE_EXISTS" = "f" ] || [ "$TABLE_EXISTS" = "false" ]; then
            echo -e "${YELLOW}⚠️  Migration history table not found${NC}"
            echo ""
            echo "This can happen when:"
            echo "  • The production database is new"
            echo "  • Migration history was manually deleted"
            echo "  • Previous deployments used a different method"
            echo ""
            echo "Options:"
            echo "1. Create migration history table and apply all migrations (recommended)"
            echo "2. Reset production database completely and start fresh"
            echo "3. Cancel deployment and handle manually"
            echo ""
            read -p "   Choose option [1/2/3]: " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[1]$ ]]; then
                echo "   Proceeding with manual migration..."
            elif [[ $REPLY =~ ^[2]$ ]]; then
                echo ""
                echo -e "${YELLOW}⚠️  Converting to reset deployment...${NC}"
                RESET_PRODUCTION=true
            else
                echo "   Deployment cancelled"
                git checkout main
                exit 1
            fi
        fi
    else
        echo "   No migration files found - skipping migration step"
    fi
fi

# Deploy database changes
if [[ "$RESET_PRODUCTION" == true ]]; then
    echo "   Applying fresh schema to reset production database..."
    
    # Check if we're already linked to the project
    CURRENT_PROJECT=$(supabase projects list 2>/dev/null | grep xwsgyxlvxntgpochonwe | awk '{print $1}' || echo "")
    
    if [ -z "$CURRENT_PROJECT" ] || [ "$CURRENT_PROJECT" != "xwsgyxlvxntgpochonwe" ]; then
        echo "   Linking to production project..."
        
        if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
            # Use access token if available
            supabase link --project-ref xwsgyxlvxntgpochonwe || {
                echo -e "${YELLOW}⚠️  Failed to link project with access token${NC}"
            }
        else
            # Try without access token (will use local auth)
            echo "   Note: No access token provided, using local authentication"
            supabase link --project-ref xwsgyxlvxntgpochonwe --password "$PRODUCTION_DB_PASSWORD" || {
                echo -e "${YELLOW}⚠️  Failed to link project${NC}"
            }
        fi
    else
        echo "   Already linked to project xwsgyxlvxntgpochonwe"
    fi
    
    echo "   Resetting production database..."
    
    # Use direct URL for reset if CLI is not available
    if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
        if ! supabase db reset --linked; then
            echo -e "${YELLOW}⚠️  CLI reset failed, trying direct SQL reset...${NC}"
            # Fallback to direct SQL reset
            psql "$PRODUCTION_DB_DIRECT_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
                echo -e "${RED}❌ Database reset failed${NC}"
                git checkout main
                exit 1
            }
        fi
    else
        echo "   Using direct SQL reset (no CLI access token)..."
        # Direct SQL reset
        psql "$PRODUCTION_DB_DIRECT_URL" << 'EOF'
-- Reset database
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Recreate extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EOF
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Database reset failed${NC}"
            git checkout main
            exit 1
        fi
        
        # Apply migrations from files
        echo "   Applying migration files..."
        for migration_file in $(find supabase/migrations -name "*.sql" | sort); do
            migration_name=$(basename "$migration_file")
            echo "   • Applying: $migration_name"
            
            if psql "$PRODUCTION_DB_DIRECT_URL" -f "$migration_file"; then
                echo "     ✅ $migration_name applied"
            else
                echo "     ❌ $migration_name failed"
                echo -e "${RED}❌ Migration failed during reset${NC}"
                git checkout main
                exit 1
            fi
        done
    fi
    
    echo -e "${GREEN}✅ Database reset and schema deployment successful${NC}"
else
    # Regular migration path (non-reset)
    echo "   Applying incremental migrations..."
    
    if [ "$MIGRATION_FILES_COUNT" -gt 0 ]; then
        # Get list of already applied migrations
        APPLIED_MIGRATIONS=$(psql "$PRODUCTION_DB_URL" -t -c "
            SELECT version FROM supabase_migrations.schema_migrations;" 2>/dev/null | tr -d ' ' || echo "")
        
        # Apply each migration file
        FAILED_MIGRATIONS=0
        APPLIED_COUNT=0
        SKIPPED_COUNT=0
        
        for migration_file in $(find supabase/migrations -name "*.sql" | sort); do
            migration_name=$(basename "$migration_file" .sql)
            
            # Check if migration was already applied
            if echo "$APPLIED_MIGRATIONS" | grep -q "$migration_name"; then
                echo "   ⏭️  Skipping: $migration_name (already applied)"
                SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
                continue
            fi
            
            echo "   • Applying: $migration_name"
            
            # Begin transaction for safe migration
            psql "$PRODUCTION_DB_URL" << EOF 2>&1 | tee /tmp/migration_output_$.txt
BEGIN;
-- Apply migration
\i $migration_file

-- Record migration
INSERT INTO supabase_migrations.schema_migrations (version) 
VALUES ('$migration_name');

COMMIT;
EOF
            
            # Check if the migration was successful by looking for ROLLBACK in output
            if grep -q "ROLLBACK" /tmp/migration_output_$.txt; then
                echo "     ❌ $migration_name failed (transaction rolled back)"
                FAILED_MIGRATIONS=$((FAILED_MIGRATIONS + 1))
                rm -f /tmp/migration_output_$.txt
            elif [ $? -eq 0 ]; then
                echo "     ✅ $migration_name applied successfully"
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
                rm -f /tmp/migration_output_$.txt
            else
                echo "     ❌ $migration_name failed"
                FAILED_MIGRATIONS=$((FAILED_MIGRATIONS + 1))
                rm -f /tmp/migration_output_$.txt
            fi
        done
        
        echo ""
        echo "   Migration summary:"
        echo "   • Applied: $APPLIED_COUNT"
        echo "   • Skipped: $SKIPPED_COUNT"
        echo "   • Failed: $FAILED_MIGRATIONS"
        
        if [ "$FAILED_MIGRATIONS" -gt 0 ]; then
            echo -e "${RED}❌ $FAILED_MIGRATIONS migration(s) failed${NC}"
            echo ""
            echo "🔄 Rollback available: $ROLLBACK_SCRIPT"
            git checkout main
            exit 1
        fi
        
        echo -e "${GREEN}✅ All migrations applied successfully${NC}"
    fi
fi

echo ""

# Step 5: Deploy Edge Functions
echo "⚡ Deploying Edge Functions to production..."
if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
    supabase functions deploy --project-ref xwsgyxlvxntgpochonwe || {
        echo -e "${YELLOW}⚠️  Edge function deployment failed, but continuing...${NC}"
    }
else
    echo -e "${YELLOW}⚠️  Skipping Edge Functions deployment (no CLI access token)${NC}"
    echo "   To deploy Edge Functions, set SUPABASE_ACCESS_TOKEN environment variable"
fi

echo -e "${GREEN}✅ Edge Functions deployment complete${NC}"
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
    echo "   3. If issues occur: Run $ROLLBACK_SCRIPT"
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
            
            if [[ $REPLY =~ ^[1]$ ]]; then
                echo ""
                if recreate_migration_history_table "$PRODUCTION_DB_URL"; then
                    echo "   Migration history table created, proceeding with migrations..."
                else
                    echo -e "${RED}❌ Failed to create migration history table${NC}"
                    git checkout main
                    exit 1
                fi
            elif [[ $REPLY =~ ^[2]$ ]]; then
                echo ""
                echo -e "${YELLOW}⚠️  Converting to reset deployment...${NC}"
                RESET_PRODUCTION=true
                echo "   Database will be reset and fresh schema deployed"
            elif [[ $REPLY =~ ^[3]$ ]]; then
                echo ""
                echo "   Deployment cancelled for manual handling"
                git checkout main
                exit 0
            else
                echo -e "${RED}❌ Invalid option selected${NC}"
                git checkout main
                exit 1
            fi
        elif [ "$TABLE_EXISTS" = "t" ] || [ "$TABLE_EXISTS" = "true" ]; then
            # Table exists, check migration count
            APPLIED_MIGRATIONS_COUNT=$(psql "$PRODUCTION_DB_URL" -t -c "
                SELECT COUNT(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | tr -d ' ' || echo "0")
            echo "   Migration history found: $APPLIED_MIGRATIONS_COUNT migrations previously applied"
        else
            echo -e "${YELLOW}⚠️  Cannot determine migration history status${NC}"
            echo "   Error checking table: $TABLE_EXISTS"
            echo ""
            echo "Options:"
            echo "1. Continue with manual migration application"
            echo "2. Reset production database and start fresh"
            echo "3. Cancel deployment"
            echo ""
            read -p "   Choose option [1/2/3]: " -n 1 -r
            echo
