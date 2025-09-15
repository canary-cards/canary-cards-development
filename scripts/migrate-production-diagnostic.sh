#!/bin/bash

# 🔍 Production Migration Diagnostic System
# Usage: npm run migration:diagnostic
# 
# Comprehensive diagnostic tool to identify migration issues
# - Tests each component independently
# - Provides detailed environment analysis  
# - Generates troubleshooting report
# - Validates all prerequisites

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
DIAGNOSTIC_LOG="migration-diagnostic-$(date +%Y%m%d_%H%M%S).log"

echo -e "${CYAN}🔍 Production Migration Diagnostic System${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Comprehensive diagnosis of migration system health${NC}"
echo ""

# Function to run with timeout
run_with_timeout() {
    local timeout=$1
    local command="$2"
    local description="$3"
    
    echo -e "${CYAN}Testing: $description${NC}"
    echo "$(date): Testing $description" >> "$DIAGNOSTIC_LOG"
    
    if timeout "$timeout" bash -c "$command" &>> "$DIAGNOSTIC_LOG"; then
        echo -e "${GREEN}✅ $description - SUCCESS${NC}"
        return 0
    else
        echo -e "${RED}❌ $description - FAILED (timeout: ${timeout}s)${NC}"
        return 1
    fi
}

# Function to test network connectivity
test_connectivity() {
    echo -e "${PURPLE}🌐 Step 1: Network Connectivity Tests${NC}"
    
    run_with_timeout 10 "ping -c 1 supabase.com > /dev/null 2>&1" "Internet connectivity"
    run_with_timeout 10 "nslookup ${STAGING_PROJECT_ID}.supabase.co > /dev/null 2>&1" "Staging DNS resolution"
    run_with_timeout 10 "nslookup ${PRODUCTION_PROJECT_ID}.supabase.co > /dev/null 2>&1" "Production DNS resolution"
    
    # Test HTTPS connectivity
    run_with_timeout 15 "curl -s -I https://${STAGING_PROJECT_ID}.supabase.co > /dev/null 2>&1" "Staging HTTPS connectivity"
    run_with_timeout 15 "curl -s -I https://${PRODUCTION_PROJECT_ID}.supabase.co > /dev/null 2>&1" "Production HTTPS connectivity"
}

# Function to test CLI functionality
test_cli() {
    echo -e "${PURPLE}⚡ Step 2: Supabase CLI Tests${NC}"
    
    # Check CLI version
    if command -v supabase &> /dev/null; then
        CLI_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
        echo -e "${GREEN}✅ CLI installed: $CLI_VERSION${NC}"
        echo "$(date): CLI version: $CLI_VERSION" >> "$DIAGNOSTIC_LOG"
    else
        echo -e "${RED}❌ Supabase CLI not found${NC}"
        echo "$(date): CLI not found" >> "$DIAGNOSTIC_LOG"
        return 1
    fi
    
    # Test CLI connectivity with timeout
    echo -e "${CYAN}Testing CLI connection to staging...${NC}"
    timeout 30s supabase link --project-ref "$STAGING_PROJECT_ID" &>> "$DIAGNOSTIC_LOG" && {
        echo -e "${GREEN}✅ CLI staging connection - SUCCESS${NC}"
        
        # Test function list with timeout
        echo -e "${CYAN}Testing Edge Function listing...${NC}"
        timeout 20s supabase functions list &>> "$DIAGNOSTIC_LOG" && {
            echo -e "${GREEN}✅ Edge Functions accessible${NC}"
            
            # Check if migration-helper exists
            if supabase functions list 2>/dev/null | grep -q "migration-helper"; then
                echo -e "${GREEN}✅ migration-helper function found${NC}"
            else
                echo -e "${RED}❌ migration-helper function NOT found${NC}"
                echo "$(date): migration-helper function missing" >> "$DIAGNOSTIC_LOG"
            fi
        } || {
            echo -e "${RED}❌ Edge Functions not accessible${NC}"
        }
    } || {
        echo -e "${RED}❌ CLI staging connection - FAILED${NC}"
        echo "$(date): CLI connection failed" >> "$DIAGNOSTIC_LOG"
    }
}

# Function to test Edge Function directly
test_edge_function() {
    echo -e "${PURPLE}🔧 Step 3: Edge Function Direct Tests${NC}"
    
    # Test with different payloads and timeouts
    local test_payloads=(
        '{"action":"get_credentials","environment":"production"}'
        '{"action":"validate_connection","environment":"production"}'
        '{"action":"check_database_empty","environment":"production"}'
    )
    
    for payload in "${test_payloads[@]}"; do
        local action=$(echo "$payload" | grep -o '"action":"[^"]*"' | cut -d'"' -f4)
        echo -e "${CYAN}Testing Edge Function: $action${NC}"
        
        timeout 45s supabase functions invoke migration-helper --body "$payload" &>> "$DIAGNOSTIC_LOG" && {
            echo -e "${GREEN}✅ Edge Function $action - SUCCESS${NC}"
        } || {
            echo -e "${RED}❌ Edge Function $action - FAILED${NC}"
            echo "$(date): Edge Function $action failed" >> "$DIAGNOSTIC_LOG"
        }
    done
}

# Function to check secrets configuration
test_secrets() {
    echo -e "${PURPLE}🔐 Step 4: Secrets Configuration Check${NC}"
    
    local required_secrets=(
        "PRODUCTION_PROJECT_ID"
        "PRODUCTION_DB_URL" 
        "PRODUCTION_DB_PASSWORD"
        "PRODUCTION_SUPABASE_ANON_KEY"
        "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"
        "STAGING_PROJECT_ID"
        "STAGING_DB_URL"
        "STAGING_DB_PASSWORD"
        "STAGING_SUPABASE_SERVICE_ROLE_KEY"
    )
    
    echo -e "${CYAN}Testing Edge Function secret validation...${NC}"
    
    # Create a test payload to check if secrets are accessible
    timeout 30s supabase functions invoke migration-helper --body '{"action":"validate_secrets"}' &>> "$DIAGNOSTIC_LOG" && {
        echo -e "${GREEN}✅ Secrets validation endpoint accessible${NC}"
    } || {
        echo -e "${YELLOW}⚠️  Secrets validation endpoint not available${NC}"
    }
    
    echo -e "${BLUE}Required secrets for production migration:${NC}"
    for secret in "${required_secrets[@]}"; do
        echo -e "${YELLOW}  • $secret${NC}"
    done
}

# Function to test file system
test_filesystem() {
    echo -e "${PURPLE}📁 Step 5: File System Tests${NC}"
    
    # Check migration files
    MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")
    echo -e "${BLUE}Migration files found: $MIGRATION_COUNT${NC}"
    
    # Check supabase directory structure
    if [ -d "supabase" ]; then
        echo -e "${GREEN}✅ supabase directory exists${NC}"
        
        if [ -d "supabase/functions" ]; then
            echo -e "${GREEN}✅ functions directory exists${NC}"
            
            if [ -f "supabase/functions/migration-helper/index.ts" ]; then
                echo -e "${GREEN}✅ migration-helper function file exists${NC}"
            else
                echo -e "${RED}❌ migration-helper function file missing${NC}"
            fi
        else
            echo -e "${RED}❌ functions directory missing${NC}"
        fi
        
        if [ -f "supabase/config.toml" ]; then
            echo -e "${GREEN}✅ config.toml exists${NC}"
        else
            echo -e "${RED}❌ config.toml missing${NC}"
        fi
    else
        echo -e "${RED}❌ supabase directory missing${NC}"
    fi
}

# Function to generate troubleshooting report
generate_report() {
    echo -e "${PURPLE}📋 Step 6: Generating Diagnostic Report${NC}"
    
    REPORT_FILE="migration-diagnostic-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# Production Migration Diagnostic Report

**Generated:** $(date)
**Staging Project:** $STAGING_PROJECT_ID
**Production Project:** $PRODUCTION_PROJECT_ID

## Test Results Summary

$(if grep -q "Internet connectivity.*SUCCESS" "$DIAGNOSTIC_LOG"; then echo "✅ Network connectivity: PASS"; else echo "❌ Network connectivity: FAIL"; fi)
$(if grep -q "CLI.*SUCCESS" "$DIAGNOSTIC_LOG"; then echo "✅ CLI functionality: PASS"; else echo "❌ CLI functionality: FAIL"; fi)
$(if grep -q "Edge Function.*SUCCESS" "$DIAGNOSTIC_LOG"; then echo "✅ Edge Functions: PASS"; else echo "❌ Edge Functions: FAIL"; fi)

## Recommendations

EOF

    # Add specific recommendations based on test results
    if ! grep -q "Internet connectivity.*SUCCESS" "$DIAGNOSTIC_LOG"; then
        echo "- **Network Issues**: Check internet connection and firewall settings" >> "$REPORT_FILE"
    fi
    
    if ! grep -q "CLI.*SUCCESS" "$DIAGNOSTIC_LOG"; then
        echo "- **CLI Issues**: Try reinstalling Supabase CLI: \`npm i -g supabase\`" >> "$REPORT_FILE"
        echo "- **Authentication**: Check if you're logged in: \`supabase login\`" >> "$REPORT_FILE"
    fi
    
    if ! grep -q "migration-helper function found" "$DIAGNOSTIC_LOG"; then
        echo "- **Missing Function**: Deploy migration-helper function first" >> "$REPORT_FILE"
        echo "- **Deploy Command**: \`supabase functions deploy migration-helper\`" >> "$REPORT_FILE"
    fi
    
    echo "- **Manual Fallback**: Use the manual migration process if automated approach fails" >> "$REPORT_FILE"
    echo "- **Logs Location**: Check \`$DIAGNOSTIC_LOG\` for detailed logs" >> "$REPORT_FILE"
    
    echo -e "${GREEN}✅ Diagnostic report generated: $REPORT_FILE${NC}"
}

# Main execution
echo "$(date): Starting diagnostic" >> "$DIAGNOSTIC_LOG"

test_connectivity
echo ""

test_cli  
echo ""

test_edge_function
echo ""

test_secrets
echo ""

test_filesystem
echo ""

generate_report

echo ""
echo -e "${GREEN}🎉 Diagnostic Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}📋 Check the following files for details:${NC}"
echo -e "${YELLOW}  • Diagnostic Log: $DIAGNOSTIC_LOG${NC}"
echo -e "${YELLOW}  • Full Report: $REPORT_FILE${NC}"
echo ""
echo -e "${CYAN}💡 Next Steps:${NC}"
echo -e "${BLUE}1. Review the diagnostic report${NC}"
echo -e "${BLUE}2. Fix any identified issues${NC}"
echo -e "${BLUE}3. Re-run: npm run migrate:production:enhanced${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"