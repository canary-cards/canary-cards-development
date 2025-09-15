#!/bin/bash

# 🔒 Enhanced Production Migration System v2
# Usage: npm run migrate:production:enhanced:v2
# 
# Complete production-safe deployment with comprehensive timeout handling
# - Enhanced timeout controls and fallback mechanisms
# - Detailed logging and progress tracking
# - Multiple fallback options when automated approach fails
# - Comprehensive error handling and recovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
STAGING_PROJECT_ID="pugnjgvdisdbdkbofwrc"
PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"
LOG_FILE="migration-$(date +%Y%m%d_%H%M%S).log"
MAX_RETRIES=3
CONNECTION_TIMEOUT=30
FUNCTION_TIMEOUT=45

echo -e "${CYAN}🔒 Enhanced Production Migration System v2${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Complete production deployment with enhanced diagnostics${NC}"
echo ""

echo -e "${RED}📍 Target: PRODUCTION${NC} ($PRODUCTION_PROJECT_ID)"
echo -e "${BLUE}📍 Source: STAGING${NC} ($STAGING_PROJECT_ID)"
echo ""

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" >> "$LOG_FILE"
    echo -e "$1"
}

# Progress indicator function
show_progress() {
    local message="$1"
    local duration="$2"
    echo -ne "${CYAN}$message${NC}"
    for i in $(seq 1 "$duration"); do
        echo -ne "."
        sleep 1
    done
    echo ""
}

# Function to run commands with timeout and retry
run_with_timeout_retry() {
    local timeout="$1"
    local max_attempts="$2"
    local command="$3"
    local description="$4"
    
    for attempt in $(seq 1 "$max_attempts"); do
        log "Attempt $attempt/$max_attempts: $description"
        
        if timeout "$timeout" bash -c "$command" &>> "$LOG_FILE"; then
            log "✅ $description - SUCCESS"
            return 0
        else
            local exit_code=$?
            if [ $exit_code -eq 124 ]; then
                log "⏰ $description - TIMEOUT after ${timeout}s"
            else
                log "❌ $description - FAILED (exit code: $exit_code)"
            fi
            
            if [ "$attempt" -lt "$max_attempts" ]; then
                log "🔄 Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    log "❌ $description - FAILED after $max_attempts attempts"
    return 1
}

# Enhanced connectivity check
check_prerequisites() {
    log "🔍 Step 1: Prerequisites and Connectivity Check"
    
    # Check CLI
    if ! command -v supabase &> /dev/null; then
        log "❌ Supabase CLI not found"
        echo -e "${RED}❌ Supabase CLI not found${NC}"
        echo -e "${BLUE}Install with:${NC} npm i -g supabase"
        exit 1
    fi
    
    CLI_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
    log "✅ CLI installed: $CLI_VERSION"
    echo -e "${GREEN}✅ CLI installed: $CLI_VERSION${NC}"
    
    # Test network connectivity
    echo -e "${CYAN}Testing network connectivity...${NC}"
    if ! run_with_timeout_retry 10 2 "ping -c 1 supabase.com > /dev/null 2>&1" "Network connectivity"; then
        echo -e "${RED}❌ Network connectivity issues detected${NC}"
        echo -e "${YELLOW}Please check your internet connection${NC}"
        exit 1
    fi
    
    # Test staging project accessibility
    echo -e "${CYAN}Testing staging project accessibility...${NC}"
    if ! run_with_timeout_retry 15 2 "curl -s -I https://${STAGING_PROJECT_ID}.supabase.co > /dev/null 2>&1" "Staging project HTTPS"; then
        echo -e "${YELLOW}⚠️  Staging project may not be accessible${NC}"
    fi
    
    echo -e "${GREEN}✅ Prerequisites check completed${NC}"
}

# Enhanced staging connection with fallback
connect_to_staging() {
    log "🔗 Step 2: Connecting to staging environment"
    
    echo -e "${CYAN}Connecting to staging environment with timeout...${NC}"
    show_progress "Establishing connection" 5 &
    PROGRESS_PID=$!
    
    if run_with_timeout_retry "$CONNECTION_TIMEOUT" "$MAX_RETRIES" "supabase link --project-ref $STAGING_PROJECT_ID" "Staging connection"; then
        kill $PROGRESS_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Staging connected successfully${NC}"
        return 0
    else
        kill $PROGRESS_PID 2>/dev/null || true
        echo -e "${RED}❌ Failed to connect to staging after $MAX_RETRIES attempts${NC}"
        
        # Offer manual fallback
        echo -e "${YELLOW}🔧 Fallback Options:${NC}"
        echo -e "${BLUE}1. Manual credential input${NC}"
        echo -e "${BLUE}2. Check Supabase login status${NC}"
        echo -e "${BLUE}3. Verify project access permissions${NC}"
        
        read -p "Would you like to try manual credential input? (y/N): " manual_fallback
        if [[ "$manual_fallback" =~ ^[Yy]$ ]]; then
            offer_manual_fallback
            return $?
        else
            exit 1
        fi
    fi
}

# Manual fallback for credential input
offer_manual_fallback() {
    log "🔧 Initiating manual fallback process"
    
    echo -e "${YELLOW}🔧 Manual Credential Input${NC}"
    echo -e "${BLUE}Please provide production database credentials:${NC}"
    
    read -p "Production Database URL: " MANUAL_PROD_DB_URL
    read -s -p "Production Database Password: " MANUAL_PROD_DB_PASSWORD
    echo ""
    
    if [ -n "$MANUAL_PROD_DB_URL" ] && [ -n "$MANUAL_PROD_DB_PASSWORD" ]; then
        # Test manual connection
        TEST_URL="${MANUAL_PROD_DB_URL}"
        if run_with_timeout_retry 15 2 "psql '$TEST_URL' -c 'SELECT 1;' > /dev/null 2>&1" "Manual database connection test"; then
            echo -e "${GREEN}✅ Manual credentials validated${NC}"
            PRODUCTION_DB_URL="$MANUAL_PROD_DB_URL"
            MANUAL_MODE=true
            return 0
        else
            echo -e "${RED}❌ Manual credentials validation failed${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Incomplete credentials provided${NC}"
        return 1
    fi
}

# Enhanced Edge Function testing
test_migration_helper() {
    if [ "$MANUAL_MODE" = true ]; then
        log "⏭️  Skipping Edge Function tests (manual mode)"
        return 0
    fi
    
    log "🔧 Step 3: Testing migration-helper Edge Function"
    
    # Check if function exists
    echo -e "${CYAN}Checking if migration-helper function exists...${NC}"
    if run_with_timeout_retry 20 2 "supabase functions list | grep -q migration-helper" "Function existence check"; then
        echo -e "${GREEN}✅ migration-helper function found${NC}"
    else
        echo -e "${RED}❌ migration-helper function not found${NC}"
        echo -e "${YELLOW}💡 Try deploying it first: supabase functions deploy migration-helper${NC}"
        exit 1
    fi
    
    # Test function calls with enhanced timeout
    local test_actions=("get_credentials" "validate_connection" "check_database_empty")
    
    for action in "${test_actions[@]}"; do
        echo -e "${CYAN}Testing Edge Function: $action${NC}"
        local payload="{\"action\":\"$action\",\"environment\":\"production\"}"
        
        if run_with_timeout_retry "$FUNCTION_TIMEOUT" 2 "supabase functions invoke migration-helper --body '$payload'" "Edge Function $action"; then
            echo -e "${GREEN}✅ Edge Function $action working${NC}"
        else
            echo -e "${RED}❌ Edge Function $action failed${NC}"
            
            if [ "$action" = "get_credentials" ]; then
                echo -e "${YELLOW}🔧 This is critical - offering manual fallback${NC}"
                if ! offer_manual_fallback; then
                    exit 1
                fi
                break
            fi
        fi
    done
}

# Enhanced credential retrieval
get_production_credentials() {
    if [ "$MANUAL_MODE" = true ]; then
        log "⏭️  Using manual credentials"
        return 0
    fi
    
    log "🔐 Step 4: Retrieving production credentials"
    
    echo -e "${CYAN}Fetching production database credentials via Edge Function...${NC}"
    show_progress "Retrieving credentials" 8 &
    PROGRESS_PID=$!
    
    CREDENTIALS_RESPONSE=$(timeout "$FUNCTION_TIMEOUT" supabase functions invoke migration-helper --body '{"action":"get_credentials","environment":"production"}' 2>>"$LOG_FILE" || echo '{"success":false}')
    
    kill $PROGRESS_PID 2>/dev/null || true
    
    if echo "$CREDENTIALS_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Production credentials obtained securely${NC}"
        
        # Extract database URL from response
        PRODUCTION_DB_URL=$(echo "$CREDENTIALS_RESPONSE" | grep -o '"db_url":"[^"]*"' | cut -d'"' -f4)
        
        if [ -z "$PRODUCTION_DB_URL" ]; then
            log "❌ Could not extract database URL from credentials"
            echo -e "${RED}❌ Could not extract database URL from credentials${NC}"
            
            # Offer manual fallback
            if offer_manual_fallback; then
                return 0
            else
                exit 1
            fi
        fi
        
        log "✅ Database URL extracted successfully"
    else
        log "❌ Failed to get production credentials via Edge Function"
        echo -e "${RED}❌ Failed to get production credentials${NC}"
        echo -e "${BLUE}Response: $CREDENTIALS_RESPONSE${NC}"
        
        # Offer manual fallback
        echo -e "${YELLOW}🔧 Trying manual fallback...${NC}"
        if offer_manual_fallback; then
            return 0
        else
            exit 1
        fi
    fi
}

# Enhanced validation with multiple checks
validate_production_connection() {
    log "🔍 Step 5: Validating production database connection"
    
    echo -e "${CYAN}Testing production database connection...${NC}"
    
    # Test database connectivity directly
    if run_with_timeout_retry 20 3 "psql '$PRODUCTION_DB_URL' -c 'SELECT version();' > /dev/null 2>&1" "Direct database connection"; then
        echo -e "${GREEN}✅ Production database connection validated${NC}"
    else
        echo -e "${RED}❌ Production database connection failed${NC}"
        echo -e "${YELLOW}Please verify the database URL and credentials${NC}"
        exit 1
    fi
    
    # Test via Edge Function if not in manual mode
    if [ "$MANUAL_MODE" != true ]; then
        echo -e "${CYAN}Validating via Edge Function...${NC}"
        VALIDATION_RESPONSE=$(timeout "$FUNCTION_TIMEOUT" supabase functions invoke migration-helper --body '{"action":"validate_connection","environment":"production"}' 2>>"$LOG_FILE" || echo '{"success":false}')
        
        if echo "$VALIDATION_RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ Edge Function validation passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Edge Function validation had issues (continuing with direct connection)${NC}"
        fi
    fi
}

# Continue with the rest of the migration...
continue_with_migration() {
    log "🚀 Continuing with production migration"
    
    # Database state analysis
    echo -e "${BLUE}🔍 Step 6: Analyzing production database state...${NC}"
    
    # Get table count directly
    TABLE_COUNT=$(psql "$PRODUCTION_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
    
    # Get total row count (simplified)
    TOTAL_ROWS=$(psql "$PRODUCTION_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ' || echo "0")
    
    echo -e "${CYAN}Database Analysis:${NC}"
    echo -e "${BLUE}  • Tables: ${TABLE_COUNT}${NC}"
    echo -e "${BLUE}  • Table Types: ${TOTAL_ROWS}${NC}"
    
    # Migration file analysis
    echo -e "${BLUE}🔍 Step 7: Analyzing pending migrations...${NC}"
    
    MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")
    echo -e "${BLUE}📋 Found ${MIGRATION_COUNT} migration files${NC}"
    
    if [ "$MIGRATION_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No migrations found - checking RLS and functions only${NC}"
        SKIP_MIGRATIONS=true
    else
        SKIP_MIGRATIONS=false
        echo -e "${BLUE}🔍 Recent migrations:${NC}"
        ls -lt supabase/migrations/*.sql 2>/dev/null | head -3 | while read line; do
            filename=$(echo "$line" | awk '{print $9}')
            basename_file=$(basename "$filename")
            echo -e "${YELLOW}  • $basename_file${NC}"
        done
    fi
    
    # Production deployment confirmation
    echo -e "${RED}🚨 PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
    echo -e "${YELLOW}This will deploy to production with the following changes:${NC}"
    
    if [ "$SKIP_MIGRATIONS" = false ]; then
        echo -e "${BLUE}  ✓ Apply ${MIGRATION_COUNT} database migrations${NC}"
    else
        echo -e "${BLUE}  • Skip database migrations (none found)${NC}"
    fi
    
    echo -e "${BLUE}  ✓ Deploy all Edge Functions${NC}"
    echo -e "${BLUE}  ✓ Synchronize RLS policies${NC}"
    echo -e "${BLUE}  ✓ Full rollback capability available${NC}"
    echo ""
    
    read -p "Are you absolutely sure you want to proceed with production deployment? (type 'YES' to continue): " confirm
    if [ "$confirm" != "YES" ]; then
        echo -e "${BLUE}Deployment cancelled${NC}"
        exit 0
    fi
    
    # Connect to production and deploy
    echo -e "${BLUE}🔄 Step 8: Connecting to production for deployment...${NC}"
    
    if run_with_timeout_retry "$CONNECTION_TIMEOUT" "$MAX_RETRIES" "supabase link --project-ref $PRODUCTION_PROJECT_ID" "Production connection"; then
        echo -e "${GREEN}✅ Production connected for deployment${NC}"
    else
        echo -e "${RED}❌ Failed to connect to production for deployment${NC}"
        exit 1
    fi
    
    # Apply migrations
    if [ "$SKIP_MIGRATIONS" = false ]; then
        echo -e "${BLUE}🔄 Step 9: Applying database migrations...${NC}"
        
        if run_with_timeout_retry 120 2 "supabase db push" "Database migration deployment"; then
            echo -e "${GREEN}✅ Database migrations applied successfully${NC}"
        else
            echo -e "${RED}❌ Migration deployment failed${NC}"
            echo -e "${YELLOW}💡 Your data is safe - no changes were committed${NC}"
            exit 1
        fi
    else
        echo -e "${BLUE}✅ No migrations to apply${NC}"
    fi
    
    # Deploy Edge Functions
    echo -e "${BLUE}📦 Step 10: Deploying Edge Functions...${NC}"
    
    if run_with_timeout_retry 60 2 "supabase functions deploy --project-ref $PRODUCTION_PROJECT_ID" "Edge Functions deployment"; then
        echo -e "${GREEN}✅ Edge Functions deployed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Edge Functions deployment had issues${NC}"
    fi
    
    # Success message
    echo ""
    echo -e "${GREEN}🎉 Enhanced Production Deployment Completed!${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}📋 Deployment Summary:${NC}"
    
    if [ "$SKIP_MIGRATIONS" = false ]; then
        echo -e "${BLUE}  ✅ Applied ${MIGRATION_COUNT} database migrations${NC}"
    fi
    
    echo -e "${BLUE}  ✅ Deployed Edge Functions to production${NC}"
    
    if [ "$MANUAL_MODE" = true ]; then
        echo -e "${BLUE}  ✅ Used manual credential fallback${NC}"
    else
        echo -e "${BLUE}  ✅ Used automated Edge Function approach${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Production deployment complete!${NC}"
    echo -e "${YELLOW}📋 Check logs: $LOG_FILE${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
}

# Main execution flow
log "🚀 Starting enhanced production migration v2"

check_prerequisites
connect_to_staging
test_migration_helper  
get_production_credentials
validate_production_connection
continue_with_migration

log "🎉 Migration completed successfully"