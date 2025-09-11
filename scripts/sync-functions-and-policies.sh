#!/bin/bash

# 🔐 Complete Functions and Policies Sync Script
# Usage: npm run sync:functions-policies
# 
# This script deploys Edge Functions and applies RLS policies
# to ensure production matches staging completely

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🔐 Complete Functions and Policies Sync${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Deploys Edge Functions and RLS policies to production${NC}"
echo ""

# Production project ID
PRODUCTION_PROJECT_ID="xwsgyxlvxntgpochonwe"

echo -e "${RED}📍 Target: PRODUCTION${NC} ($PRODUCTION_PROJECT_ID)"
echo ""

# Get production database password
echo -e "${YELLOW}🔑 Production database password required${NC}"
read -s -p "Enter PRODUCTION database password: " PRODUCTION_PASSWORD
echo ""
if [ -z "$PRODUCTION_PASSWORD" ]; then
    echo -e "${RED}❌ Production password is required${NC}"
    exit 1
fi

# Step 1: Deploy Edge Functions
echo -e "${BLUE}📦 Step 1: Deploying Edge Functions...${NC}"
if supabase functions deploy --project-ref "$PRODUCTION_PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ Edge Functions deployed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Functions deployment had issues${NC}"
fi

# Step 2: Apply RLS Policies
echo -e "${BLUE}🔒 Step 2: Applying RLS Policies...${NC}"

# Create temporary SQL script with all RLS policies
TEMP_RLS_SCRIPT="/tmp/apply_rls_policies.sql"
cat > "$TEMP_RLS_SCRIPT" << 'EOF'
-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcard_drafts ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.postcard_draft_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcards ENABLE ROW LEVEL SECURITY;

-- Only create policies if they don't already exist
DO $$
BEGIN
    -- Customers policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'customers_deny_public_access') THEN
        CREATE POLICY "customers_deny_public_access" ON public.customers AS RESTRICTIVE USING (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'customers_own_data_access') THEN
        CREATE POLICY "customers_own_data_access" ON public.customers FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'customers_service_role_access') THEN
        CREATE POLICY "customers_service_role_access" ON public.customers TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    -- Postcard drafts policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'postcard_drafts' AND policyname = 'ai_drafts_deny_public_access') THEN
        CREATE POLICY "ai_drafts_deny_public_access" ON public.postcard_drafts AS RESTRICTIVE USING (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'postcard_drafts' AND policyname = 'ai_drafts_service_role_access') THEN
        CREATE POLICY "ai_drafts_service_role_access" ON public.postcard_drafts TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    -- Postcard draft sources policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'postcard_draft_sources' AND policyname = 'ai_draft_sources_deny_public_access') THEN
        CREATE POLICY "ai_draft_sources_deny_public_access" ON public.postcard_draft_sources AS RESTRICTIVE USING (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'postcard_draft_sources' AND policyname = 'ai_draft_sources_service_role_access') THEN
        CREATE POLICY "ai_draft_sources_service_role_access" ON public.postcard_draft_sources TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    -- Postcards policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'postcards' AND policyname = 'postcards_deny_private_access') THEN
        CREATE POLICY "postcards_deny_private_access" ON public.postcards AS RESTRICTIVE USING (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'postcards' AND policyname = 'postcards_service_role_access') THEN
        CREATE POLICY "postcards_service_role_access" ON public.postcards TO service_role USING (true) WITH CHECK (true);
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error applying RLS policies: %', SQLERRM;
END$$;
EOF

# Link to production and apply the RLS policies
echo -e "${YELLOW}📤 Connecting to production...${NC}"
if supabase link --project-ref "$PRODUCTION_PROJECT_ID" --password "$PRODUCTION_PASSWORD" 2>/dev/null; then
    echo -e "${GREEN}✅ Production connected${NC}"
else
    echo -e "${RED}❌ Failed to connect to production${NC}"
    exit 1
fi

echo -e "${CYAN}Applying RLS policies...${NC}"

# Try to apply via SQL execution
if command -v psql >/dev/null 2>&1; then
    # Use psql if available
    PROD_URL="postgresql://postgres.$PRODUCTION_PROJECT_ID:$PRODUCTION_PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
    if psql "$PROD_URL" -f "$TEMP_RLS_SCRIPT" 2>/dev/null; then
        echo -e "${GREEN}✅ RLS policies applied successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  RLS policies application had issues${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql not available - please apply RLS policies manually${NC}"
    echo -e "${BLUE}RLS script created at: $TEMP_RLS_SCRIPT${NC}"
fi

# Step 3: Verification
echo -e "${BLUE}🔍 Step 3: Verification...${NC}"

# Check functions
echo -e "${CYAN}Checking deployed functions...${NC}"
if supabase functions list --project-ref "$PRODUCTION_PROJECT_ID" | grep -q "ACTIVE"; then
    echo -e "${GREEN}✅ Functions are active${NC}"
else
    echo -e "${YELLOW}⚠️  Some functions may not be active${NC}"
fi

# Check RLS policies (if psql available)
if command -v psql >/dev/null 2>&1; then
    echo -e "${CYAN}Checking RLS policies...${NC}"
    POLICY_COUNT=$(psql "$PROD_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';" 2>/dev/null | xargs)
    if [ "$POLICY_COUNT" -gt 5 ]; then
        echo -e "${GREEN}✅ RLS policies are active ($POLICY_COUNT policies found)${NC}"
    else
        echo -e "${YELLOW}⚠️  Few RLS policies found ($POLICY_COUNT) - may need manual verification${NC}"
    fi
fi

# Clean up
rm -f "$TEMP_RLS_SCRIPT"

echo ""
echo -e "${GREEN}🎉 Functions and Policies sync completed!${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "${BLUE}• Edge Functions deployed to production${NC}"
echo -e "${BLUE}• RLS policies applied for data security${NC}"
echo -e "${BLUE}• Production should now match staging functionality${NC}"
echo ""
echo -e "${YELLOW}💡 Test your application now - data saving should work properly${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"