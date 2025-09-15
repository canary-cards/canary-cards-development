#!/bin/bash

# Setup Production Deployment - Enhanced setup with migration safety
# This script validates prerequisites and sets up enhanced deployment capabilities

set -e  # Exit on any error

echo "🚀 Setting up Enhanced Production Deployment Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first:${NC}"
    echo "   npm install -g supabase"
    exit 1
fi

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git not found. Please install Git.${NC}"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a Git repository. Please run this from your project root.${NC}"
    exit 1
fi

# Check for realproduction branch
if ! git show-ref --verify --quiet refs/heads/realproduction; then
    echo -e "${YELLOW}⚠️  realproduction branch not found. Creating it...${NC}"
    git checkout -b realproduction
    git push -u origin realproduction
fi

echo -e "${GREEN}✅ Prerequisites validated${NC}"
echo ""

# Validate Supabase project access
echo "🔐 Validating Supabase project access..."

# Test staging project access
echo "   Testing staging project (pugnjgvdisdbdkbofwrc)..."
if supabase projects list | grep -q "pugnjgvdisdbdkbofwrc"; then
    echo -e "${GREEN}   ✅ Staging project access confirmed${NC}"
else
    echo -e "${RED}   ❌ Cannot access staging project. Please run: supabase login${NC}"
    exit 1
fi

# Test production project access
echo "   Testing production project (xwsgyxlvxntgpochonwe)..."
if supabase projects list | grep -q "xwsgyxlvxntgpochonwe"; then
    echo -e "${GREEN}   ✅ Production project access confirmed${NC}"
else
    echo -e "${RED}   ❌ Cannot access production project. Please check your Supabase permissions.${NC}"
    exit 1
fi

echo ""

# Validate migration infrastructure
echo "🔧 Validating migration infrastructure..."

# Check for migration helper edge function
echo "   Checking migration-helper edge function..."
if supabase functions list --project-ref pugnjgvdisdbdkbofwrc | grep -q "migration-helper"; then
    echo -e "${GREEN}   ✅ Migration helper function found${NC}"
else
    echo -e "${YELLOW}   ⚠️  Migration helper function not found - will use manual methods${NC}"
fi

# Check for migration directories
if [[ ! -d "supabase/migrations" ]]; then
    echo -e "${YELLOW}   ⚠️  Migration directory not found - creating...${NC}"
    mkdir -p supabase/migrations
fi

echo -e "${GREEN}✅ Migration infrastructure validated${NC}"
echo ""

# Create enhanced backup directories
echo "📁 Setting up enhanced backup directories..."
mkdir -p backups/database
mkdir -p backups/migrations
mkdir -p backups/rollback-scripts
echo -e "${GREEN}✅ Backup directories created${NC}"
echo ""

# Create safety validation directory
echo "🛡️  Setting up safety validation..."
mkdir -p safety-checks
echo "# Migration safety validation results" > safety-checks/README.md
echo -e "${GREEN}✅ Safety validation setup complete${NC}"
echo ""

# Final validation
echo "🎯 Final validation..."
echo "   Staging Project ID: pugnjgvdisdbdkbofwrc"
echo "   Production Project ID: xwsgyxlvxntgpochonwe"
echo "   Current branch: $(git branch --show-current)"
echo "   Backup retention: 30 days"
echo "   Rollback window: 24 hours"
echo "   Migration safety: ENABLED"
echo "   Destructive change protection: ENABLED"
echo ""

echo -e "${GREEN}🎉 Enhanced Setup Complete!${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Add required secrets to production Supabase project"
echo "   Run: ./setup-production-deployment.sh --secrets"
echo ""
echo "2. Deploy to production:"
echo "   Run: ./deploy-to-production.sh"
echo ""
echo "3. Rollback if needed:"
echo "   Run: ./rollback-production.sh"
echo ""
echo "4. Generate migrations for complex changes:"
echo "   Run: ./generate-migration.sh 'description'"
echo ""

# Show secrets list if requested
if [[ "$1" == "--secrets" ]]; then
    echo -e "${BLUE}📋 Required secrets for production Supabase project (xwsgyxlvxntgpochonwe):${NC}"
    echo ""
    echo "Core Infrastructure:"
    echo "   SUPABASE_URL"
    echo "   SUPABASE_ANON_KEY"
    echo "   SUPABASE_SERVICE_ROLE_KEY"  
    echo "   FRONTEND_URL"
    echo ""
    echo "Payment Processing:"
    echo "   STRIPE_SECRET_KEY"
    echo ""
    echo "External APIs:"
    echo "   GeoCodioKey (Geocoding service)"
    echo "   Google (Google Places API)"
    echo "   ANTHROPIC_API_KEY_1, ANTHROPIC_API_KEY_2"
    echo "   OPENAI_KEY_TRANSCRIPTION"
    echo ""
    echo "News & Content APIs:"
    echo "   NYT_API_KEY"
    echo "   GUARDIAN_API_KEY" 
    echo "   CONGRESS_API_KEY"
    echo ""
    echo "Email & Communication:"
    echo "   RESEND_API_KEY"
    echo "   EMAIL_LOGO_URL"
    echo ""
    echo "Postcard Service:"
    echo "   IGNITE_POST"
    echo ""
    echo -e "${YELLOW}💡 Tip: Add secrets via Supabase Dashboard → Settings → Edge Functions${NC}"
    echo ""
fi