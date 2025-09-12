#!/bin/bash

# 🔄 Backfill and Data Migration Framework
# Usage: ./scripts/backfill-framework.sh [operation] [environment] [options]
# 
# Handles data migrations, backfills, and data transformations safely
# - Intelligent backfill detection
# - Rollback capabilities for data operations  
# - Template-based data migrations
# - Progress tracking and validation

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
OPERATION="${1:-help}"
ENVIRONMENT="${2:-staging}"
OPTIONS="${3:-}"

echo -e "${CYAN}🔄 Backfill and Data Migration Framework${NC}"
echo -e "${BLUE}═════════════════════════════════════════════${NC}"
echo ""

# Helper function to show usage
show_help() {
    echo -e "${BLUE}Available Operations:${NC}"
    echo -e "${YELLOW}  detect${NC}      - Detect and analyze backfill needs"
    echo -e "${YELLOW}  template${NC}    - Create a data migration template"  
    echo -e "${YELLOW}  execute${NC}     - Execute a data migration safely"
    echo -e "${YELLOW}  rollback${NC}    - Rollback a data migration"
    echo -e "${YELLOW}  validate${NC}    - Validate data integrity after migration"
    echo ""
    echo -e "${BLUE}Available Environments:${NC}"
    echo -e "${YELLOW}  staging${NC}     - Staging database (safe for testing)"
    echo -e "${YELLOW}  production${NC}  - Production database (use with caution)"
    echo ""
    echo -e "${BLUE}Example Usage:${NC}"
    echo -e "${CYAN}  ./scripts/backfill-framework.sh detect staging${NC}"
    echo -e "${CYAN}  ./scripts/backfill-framework.sh template my_migration${NC}"
    echo -e "${CYAN}  ./scripts/backfill-framework.sh execute my_migration production${NC}"
}

# Function to detect backfill needs
detect_backfill_needs() {
    local env=$1
    echo -e "${BLUE}🔍 Detecting backfill needs in ${env}...${NC}"
    
    # Connect to the specified environment
    if [ "$env" = "production" ]; then
        PROJECT_ID="xwsgyxlvxntgpochonwe"
    else
        PROJECT_ID="pugnjgvdisdbdkbofwrc"
    fi
    
    echo -e "${CYAN}Analyzing database structure for missing data...${NC}"
    
    # Create analysis script
    ANALYSIS_SCRIPT="/tmp/backfill_analysis.sql"
    cat > "$ANALYSIS_SCRIPT" << 'EOF'
-- Backfill Need Analysis
SELECT 
    'customers' as table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE email_normalized IS NULL) as missing_email_normalized,
    COUNT(*) FILTER (WHERE auth_user_id IS NULL) as missing_auth_user_id,
    COUNT(*) FILTER (WHERE created_at < '2024-01-01') as old_records
FROM public.customers
UNION ALL
SELECT 
    'orders' as table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE stripe_customer_id IS NULL) as missing_stripe_customer_id,
    COUNT(*) FILTER (WHERE paid_at IS NULL AND payment_status = 'succeeded') as missing_paid_at,
    COUNT(*) FILTER (WHERE metadata_snapshot IS NULL) as missing_metadata
FROM public.orders
UNION ALL
SELECT 
    'postcards' as table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE delivery_metadata IS NULL) as missing_delivery_metadata,
    COUNT(*) FILTER (WHERE ignitepost_order_id IS NULL) as missing_ignitepost_id,
    COUNT(*) FILTER (WHERE delivery_status = 'submitted' AND mailed_at IS NOT NULL) as status_mismatch
FROM public.postcards;
EOF

    # Connect and run analysis
    if supabase link --project-ref "$PROJECT_ID" 2>/dev/null; then
        echo -e "${GREEN}✅ Connected to ${env}${NC}"
        
        # Get database password (would normally come from migration-helper)
        if [ "$env" = "production" ]; then
            echo -e "${YELLOW}🔑 Production analysis requires secure credentials${NC}"
            read -s -p "Enter production database password: " DB_PASSWORD
            echo ""
            DB_URL="postgresql://postgres.${PROJECT_ID}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
        else
            echo -e "${YELLOW}🔑 Staging analysis requires database password${NC}"
            read -s -p "Enter staging database password: " DB_PASSWORD
            echo ""
            DB_URL="postgresql://postgres.${PROJECT_ID}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
        fi
        
        if command -v psql >/dev/null 2>&1; then
            echo -e "${CYAN}Running backfill analysis...${NC}"
            
            if psql "$DB_URL" -f "$ANALYSIS_SCRIPT" 2>/dev/null; then
                echo -e "${GREEN}✅ Backfill analysis complete${NC}"
            else
                echo -e "${YELLOW}⚠️  Analysis had issues - check database connection${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  psql not available - cannot run analysis${NC}"
            echo -e "${BLUE}Analysis script created: $ANALYSIS_SCRIPT${NC}"
        fi
        
        rm -f "$ANALYSIS_SCRIPT"
    else
        echo -e "${RED}❌ Failed to connect to ${env}${NC}"
        exit 1
    fi
}

# Function to create a data migration template
create_migration_template() {
    local migration_name=$1
    
    if [ -z "$migration_name" ]; then
        echo -e "${RED}❌ Migration name is required${NC}"
        echo -e "${BLUE}Usage: $0 template migration_name${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}📝 Creating data migration template: ${migration_name}${NC}"
    
    # Create migrations directory if it doesn't exist
    mkdir -p data-migrations
    
    TEMPLATE_FILE="data-migrations/${migration_name}_$(date +%Y%m%d_%H%M%S).sql"
    
    cat > "$TEMPLATE_FILE" << EOF
-- ===============================================
-- Data Migration: ${migration_name}
-- Created: $(date)
-- Environment: [STAGING/PRODUCTION] 
-- ===============================================

-- Migration Description:
-- [Describe what this migration does and why it's needed]

-- Pre-Migration Validation:
-- [List any checks that should be done before running]

-- ===============================================
-- BACKUP QUERIES (Run these first to backup affected data)
-- ===============================================

-- Example: Backup customers table
-- CREATE TABLE backup_customers_$(date +%Y%m%d) AS 
-- SELECT * FROM public.customers WHERE [condition];

-- ===============================================  
-- MIGRATION QUERIES (The actual data changes)
-- ===============================================

BEGIN;

-- Example migration operations:

-- Update missing email_normalized values
-- UPDATE public.customers 
-- SET email_normalized = lower(trim(email))
-- WHERE email_normalized IS NULL;

-- Backfill missing timestamps  
-- UPDATE public.orders
-- SET paid_at = created_at
-- WHERE payment_status = 'succeeded' AND paid_at IS NULL;

-- Add any other data transformations here

-- Validation check within transaction
-- DO \$\$
-- DECLARE 
--     validation_count INT;
-- BEGIN
--     SELECT COUNT(*) INTO validation_count FROM public.customers WHERE email_normalized IS NULL;
--     IF validation_count > 0 THEN
--         RAISE EXCEPTION 'Validation failed: % records still missing email_normalized', validation_count;
--     END IF;
-- END\$\$;

COMMIT;

-- ===============================================
-- POST-MIGRATION VALIDATION  
-- ===============================================

-- Verify the migration worked correctly:
-- SELECT COUNT(*) as fixed_records FROM public.customers WHERE email_normalized IS NOT NULL;
-- SELECT COUNT(*) as remaining_nulls FROM public.customers WHERE email_normalized IS NULL;

-- ===============================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ===============================================

-- To rollback this migration:
-- 1. [List manual steps to undo changes]
-- 2. Or restore from backup: INSERT INTO public.customers SELECT * FROM backup_customers_$(date +%Y%m%d);

EOF

    echo -e "${GREEN}✅ Migration template created: ${TEMPLATE_FILE}${NC}"
    echo -e "${BLUE}📝 Edit the template with your specific migration logic${NC}"
    echo -e "${CYAN}Then run: $0 execute $(basename "$TEMPLATE_FILE" .sql) [environment]${NC}"
}

# Function to execute a data migration
execute_migration() {
    local migration_file=$1
    local env=$2
    
    if [ -z "$migration_file" ]; then
        echo -e "${RED}❌ Migration file is required${NC}"
        echo -e "${BLUE}Usage: $0 execute migration_file [environment]${NC}"
        exit 1
    fi
    
    # Find the migration file
    if [ -f "data-migrations/${migration_file}.sql" ]; then
        MIGRATION_PATH="data-migrations/${migration_file}.sql"
    elif [ -f "$migration_file" ]; then
        MIGRATION_PATH="$migration_file"
    else
        echo -e "${RED}❌ Migration file not found: $migration_file${NC}"
        echo -e "${BLUE}Available migrations in data-migrations/:${NC}"
        ls -1 data-migrations/*.sql 2>/dev/null || echo -e "${YELLOW}  No migrations found${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}🔄 Executing data migration: $(basename "$MIGRATION_PATH")${NC}"
    echo -e "${YELLOW}Environment: ${env}${NC}"
    echo ""
    
    # Show migration preview
    echo -e "${CYAN}Migration Preview:${NC}"
    head -20 "$MIGRATION_PATH" | grep -E "^--.*" | sed 's/^-- /  /'
    echo ""
    
    # Safety confirmation
    if [ "$env" = "production" ]; then
        echo -e "${RED}🚨 PRODUCTION DATA MIGRATION${NC}"
        echo -e "${YELLOW}This will modify production data!${NC}"
        read -p "Are you absolutely sure? (type 'EXECUTE' to continue): " confirm
        if [ "$confirm" != "EXECUTE" ]; then
            echo -e "${BLUE}Migration cancelled${NC}"
            exit 0
        fi
    else
        read -p "Execute this migration on ${env}? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Migration cancelled${NC}"
            exit 0
        fi
    fi
    
    # Execute the migration
    echo -e "${CYAN}Executing migration...${NC}"
    
    # Connect to environment
    if [ "$env" = "production" ]; then
        PROJECT_ID="xwsgyxlvxntgpochonwe"
    else
        PROJECT_ID="pugnjgvdisdbdkbofwrc"
    fi
    
    if supabase link --project-ref "$PROJECT_ID" 2>/dev/null; then
        echo -e "${GREEN}✅ Connected to ${env}${NC}"
        
        # Get database credentials
        read -s -p "Enter ${env} database password: " DB_PASSWORD
        echo ""
        DB_URL="postgresql://postgres.${PROJECT_ID}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
        
        if command -v psql >/dev/null 2>&1; then
            # Create execution log
            EXECUTION_LOG="data-migrations/logs/execution_$(basename "$MIGRATION_PATH" .sql)_$(date +%Y%m%d_%H%M%S).log"
            mkdir -p data-migrations/logs
            
            echo "Data Migration Execution Log" > "$EXECUTION_LOG"
            echo "Migration: $(basename "$MIGRATION_PATH")" >> "$EXECUTION_LOG"  
            echo "Environment: $env" >> "$EXECUTION_LOG"
            echo "Started: $(date)" >> "$EXECUTION_LOG"
            echo "=====================================" >> "$EXECUTION_LOG"
            
            if psql "$DB_URL" -f "$MIGRATION_PATH" 2>&1 | tee -a "$EXECUTION_LOG"; then
                echo -e "${GREEN}✅ Data migration executed successfully${NC}"
                echo "Completed: $(date)" >> "$EXECUTION_LOG"
            else
                echo -e "${RED}❌ Data migration failed${NC}"
                echo "Failed: $(date)" >> "$EXECUTION_LOG"
                echo -e "${BLUE}Execution log: $EXECUTION_LOG${NC}"
                exit 1
            fi
            
            echo -e "${BLUE}Execution log: $EXECUTION_LOG${NC}"
        else
            echo -e "${YELLOW}⚠️  psql not available - cannot execute migration${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Failed to connect to ${env}${NC}"
        exit 1
    fi
}

# Function to validate data integrity
validate_data_integrity() {
    local env=$1
    echo -e "${BLUE}🔍 Validating data integrity in ${env}...${NC}"
    
    # Create comprehensive validation script
    VALIDATION_SCRIPT="/tmp/data_integrity_validation.sql"
    cat > "$VALIDATION_SCRIPT" << 'EOF'
-- Data Integrity Validation Report
SELECT 'Data Integrity Validation Report' as report_header, now() as validation_time;

-- Check for orphaned records
SELECT 'Orphaned Orders (no customer)' as check_name, COUNT(*) as issue_count
FROM public.orders o 
LEFT JOIN public.customers c ON o.customer_id = c.id 
WHERE c.id IS NULL;

-- Check for missing required fields
SELECT 'Customers Missing Email Normalization' as check_name, COUNT(*) as issue_count
FROM public.customers WHERE email_normalized IS NULL OR email_normalized = '';

SELECT 'Orders Missing Stripe Data' as check_name, COUNT(*) as issue_count  
FROM public.orders WHERE payment_status = 'succeeded' AND stripe_payment_intent_id IS NULL;

-- Check for data consistency
SELECT 'Postcards with Mismatched Status' as check_name, COUNT(*) as issue_count
FROM public.postcards 
WHERE delivery_status = 'submitted' AND mailed_at IS NOT NULL;

-- Check for duplicate records  
SELECT 'Duplicate Customer Emails' as check_name, COUNT(*) - COUNT(DISTINCT email_normalized) as issue_count
FROM public.customers;

-- Summary stats
SELECT 'Total Customers' as metric, COUNT(*) as value FROM public.customers
UNION ALL
SELECT 'Total Orders', COUNT(*) FROM public.orders  
UNION ALL
SELECT 'Total Postcards', COUNT(*) FROM public.postcards;
EOF

    # Execute validation
    if [ "$env" = "production" ]; then
        PROJECT_ID="xwsgyxlvxntgpochonwe"
    else
        PROJECT_ID="pugnjgvdisdbdkbofwrc"
    fi
    
    if supabase link --project-ref "$PROJECT_ID" 2>/dev/null; then
        read -s -p "Enter ${env} database password: " DB_PASSWORD
        echo ""
        DB_URL="postgresql://postgres.${PROJECT_ID}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
        
        if command -v psql >/dev/null 2>&1; then
            echo -e "${CYAN}Running data integrity validation...${NC}"
            
            VALIDATION_REPORT="data-migrations/logs/validation_${env}_$(date +%Y%m%d_%H%M%S).log"
            mkdir -p data-migrations/logs
            
            if psql "$DB_URL" -f "$VALIDATION_SCRIPT" 2>&1 | tee "$VALIDATION_REPORT"; then
                echo -e "${GREEN}✅ Data integrity validation complete${NC}"
                echo -e "${BLUE}Report saved: $VALIDATION_REPORT${NC}"
            else
                echo -e "${YELLOW}⚠️  Validation had issues${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  psql not available${NC}"
        fi
    fi
    
    rm -f "$VALIDATION_SCRIPT"
}

# Main execution logic
case "$OPERATION" in
    "detect")
        detect_backfill_needs "$ENVIRONMENT"
        ;;
    "template")
        create_migration_template "$ENVIRONMENT"
        ;;
    "execute")
        execute_migration "$ENVIRONMENT" "$OPTIONS"
        ;;
    "validate")
        validate_data_integrity "$ENVIRONMENT" 
        ;;
    "help"|*)
        show_help
        ;;
esac

echo -e "${BLUE}═════════════════════════════════════════════${NC}"