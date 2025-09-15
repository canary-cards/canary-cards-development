#!/bin/bash

# Setup Production Deployment - One-time setup script
# This script validates prerequisites and sets up deployment capabilities

set -e  # Exit on any error

echo "🚀 Setting up Production Deployment Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

# Create backup directories
echo "📁 Setting up backup directories..."
mkdir -p backups/database
mkdir -p backups/migrations
echo -e "${GREEN}✅ Backup directories created${NC}"
echo ""

# Final validation
echo "🎯 Final validation..."
echo "   Staging Project ID: pugnjgvdisdbdkbofwrc"
echo "   Production Project ID: xwsgyxlvxntgpochonwe"
echo "   Current branch: $(git branch --show-current)"
echo "   Backup retention: 30 days"
echo "   Rollback window: 24 hours"
echo ""

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Add required secrets to production Supabase project (run this script with --secrets for list)"
echo "2. Run: ./deploy-to-production.sh (when ready to deploy)"
echo "3. Run: ./rollback-production.sh (if rollback needed)"
echo ""

# Show secrets list if requested
if [[ "$1" == "--secrets" ]]; then
    echo "📋 Required secrets to add to production Supabase project (xwsgyxlvxntgpochonwe):"
    echo ""
    echo "Core Infrastructure:"
    echo "   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    echo "   FRONTEND_URL"
    echo ""
    echo "Payment Processing:"
    echo "   STRIPE_SECRET_KEY"
    echo ""
    echo "External APIs:"
    echo "   GEOCODIO_API_KEY (or GeoCodioKey)"
    echo "   Google (Google Places API key)"
    echo "   ANTHROPIC_API_KEY_1, ANTHROPIC_API_KEY_2, ANTHROPIC_API_KEY_3"
    echo "   OPENAI_KEY_TRANSCRIPTION"
    echo ""
    echo "News & Content APIs:"
    echo "   NYT_API_KEY, GUARDIAN_API_KEY, CONGRESS_API_KEY"
    echo ""
    echo "Email & Communication:"
    echo "   RESEND_API_KEY, EMAIL_LOGO_URL"
    echo ""
    echo "Postcard Service:"
    echo "   IGNITE_POST"
    echo ""
fi