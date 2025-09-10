#!/bin/bash

# 📋 Migration Review and Validation Tool
# Usage: npm run migration:review
# 
# Reviews pending migrations for production safety before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}📋 Migration Review & Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Analyzing migrations for production safety${NC}"
echo ""

# Find all migration files
MIGRATION_FILES=($(find supabase/migrations -name "*.sql" | sort))

if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No migration files found${NC}"
    exit 0
fi

echo -e "${BLUE}🔍 Found ${#MIGRATION_FILES[@]} migration files${NC}"
echo ""

# Initialize counters
SAFE_COUNT=0
WARNING_COUNT=0
DANGEROUS_COUNT=0

# Review each migration
for migration_file in "${MIGRATION_FILES[@]}"; do
    filename=$(basename "$migration_file")
    echo -e "${BLUE}📄 Reviewing: ${YELLOW}$filename${NC}"
    
    # Check file size
    size=$(wc -c < "$migration_file")
    if [ $size -gt 50000 ]; then
        echo -e "${YELLOW}  ⚠️  Large migration (${size} bytes) - consider breaking into smaller pieces${NC}"
    fi
    
    # Safety analysis
    ISSUES=()
    WARNINGS=()
    SAFE_PATTERNS=()
    
    # Read the file content
    content=$(cat "$migration_file")
    
    # Check for dangerous patterns
    if echo "$content" | grep -qi "drop table\|drop column\|truncate\|delete from"; then
        ISSUES+=("Contains destructive operations (DROP/TRUNCATE/DELETE)")
        ((DANGEROUS_COUNT++))
    fi
    
    if echo "$content" | grep -qi "alter table.*drop"; then
        ISSUES+=("Contains column/constraint drops")
        ((DANGEROUS_COUNT++))
    fi
    
    if echo "$content" | grep -qi "alter.*type.*using"; then
        ISSUES+=("Contains type conversions that may lose data")
        ((WARNING_COUNT++))
    fi
    
    # Check for missing safety patterns
    if echo "$content" | grep -qi "create table" && ! echo "$content" | grep -qi "if not exists"; then
        WARNINGS+=("CREATE TABLE without IF NOT EXISTS")
        ((WARNING_COUNT++))
    fi
    
    if echo "$content" | grep -qi "add column" && ! echo "$content" | grep -qi "if not exists"; then
        WARNINGS+=("ADD COLUMN without IF NOT EXISTS")
        ((WARNING_COUNT++))
    fi
    
    if echo "$content" | grep -qi "create index" && ! echo "$content" | grep -qi "concurrently"; then
        WARNINGS+=("CREATE INDEX without CONCURRENTLY (may lock table)")
        ((WARNING_COUNT++))
    fi
    
    # Check for good safety patterns
    if echo "$content" | grep -qi "if not exists"; then
        SAFE_PATTERNS+=("Uses IF NOT EXISTS patterns")
    fi
    
    if echo "$content" | grep -qi "begin\|commit\|rollback"; then
        SAFE_PATTERNS+=("Uses transaction controls")
    fi
    
    if echo "$content" | grep -qi -E "-- production safety|-- review required"; then
        SAFE_PATTERNS+=("Has safety documentation")
    fi
    
    # Display results for this file
    if [ ${#ISSUES[@]} -gt 0 ]; then
        echo -e "${RED}  ❌ DANGEROUS OPERATIONS FOUND:${NC}"
        for issue in "${ISSUES[@]}"; do
            echo -e "${RED}    • $issue${NC}"
        done
    fi
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo -e "${YELLOW}  ⚠️  WARNINGS:${NC}"
        for warning in "${WARNINGS[@]}"; do
            echo -e "${YELLOW}    • $warning${NC}"
        done
    fi
    
    if [ ${#SAFE_PATTERNS[@]} -gt 0 ]; then
        echo -e "${GREEN}  ✅ SAFETY PATTERNS:${NC}"
        for pattern in "${SAFE_PATTERNS[@]}"; do
            echo -e "${GREEN}    • $pattern${NC}"
        done
    fi
    
    if [ ${#ISSUES[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
        echo -e "${GREEN}  ✅ No issues detected${NC}"
        ((SAFE_COUNT++))
    fi
    
    echo ""
done

# Overall summary
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 MIGRATION REVIEW SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Safe migrations: $SAFE_COUNT${NC}"
echo -e "${YELLOW}⚠️  Migrations with warnings: $WARNING_COUNT${NC}"
echo -e "${RED}❌ Dangerous migrations: $DANGEROUS_COUNT${NC}"
echo ""

# Recommendations
if [ $DANGEROUS_COUNT -gt 0 ]; then
    echo -e "${RED}🚨 RECOMMENDATION: DO NOT DEPLOY${NC}"
    echo -e "${RED}Fix dangerous operations before deploying to production${NC}"
    echo -e "${BLUE}Suggested actions:${NC}"
    echo -e "${BLUE}• Review and modify dangerous migrations${NC}"
    echo -e "${BLUE}• Consider data migration strategies${NC}"
    echo -e "${BLUE}• Test on staging environment first${NC}"
    echo ""
    exit 1
elif [ $WARNING_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  RECOMMENDATION: REVIEW CAREFULLY${NC}"
    echo -e "${YELLOW}Address warnings before production deployment${NC}"
    echo -e "${BLUE}Suggested actions:${NC}"
    echo -e "${BLUE}• Add IF NOT EXISTS clauses where appropriate${NC}"
    echo -e "${BLUE}• Use CONCURRENTLY for index creation${NC}"
    echo -e "${BLUE}• Test on staging environment first${NC}"
    echo ""
else
    echo -e "${GREEN}✅ RECOMMENDATION: SAFE TO DEPLOY${NC}"
    echo -e "${GREEN}All migrations appear production-safe${NC}"
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "${BLUE}• Deploy with: npm run migrate:production:safe${NC}"
    echo ""
fi

echo -e "${BLUE}═══════════════════════════════════════════${NC}"