#!/bin/bash

# Database Migration Deployment Script
# Usage: ./scripts/deploy-migrations.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying database migrations to $ENVIRONMENT..."

# Load environment variables
if [ "$ENVIRONMENT" = "production" ]; then
    if [ -z "$SUPABASE_PROD_PROJECT_ID" ]; then
        echo "❌ Error: SUPABASE_PROD_PROJECT_ID environment variable is required"
        exit 1
    fi
    PROJECT_ID="$SUPABASE_PROD_PROJECT_ID"
    echo "📍 Targeting production database: $PROJECT_ID"
elif [ "$ENVIRONMENT" = "staging" ]; then
    if [ -z "$SUPABASE_STAGING_PROJECT_ID" ]; then
        echo "❌ Error: SUPABASE_STAGING_PROJECT_ID environment variable is required"
        exit 1
    fi
    PROJECT_ID="$SUPABASE_STAGING_PROJECT_ID"
    echo "📍 Targeting staging database: $PROJECT_ID"
else
    echo "❌ Error: Environment must be 'staging' or 'production'"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "   Install it with: npm i -g supabase"
    exit 1
fi

# Backup current migrations (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📦 Creating backup of current database schema..."
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    mkdir -p backups
    supabase db dump --project-id "$PROJECT_ID" --data-only > "backups/backup_${ENVIRONMENT}_${TIMESTAMP}.sql"
    echo "✅ Backup created: backups/backup_${ENVIRONMENT}_${TIMESTAMP}.sql"
fi

# Run database migrations
echo "🔄 Running database migrations..."
if supabase db push --project-id "$PROJECT_ID"; then
    echo "✅ Database migrations completed successfully for $ENVIRONMENT"
    
    # Verify migrations
    echo "🔍 Verifying database schema..."
    supabase db diff --project-id "$PROJECT_ID" --use-migra
    
    echo "🎉 Deployment to $ENVIRONMENT completed successfully!"
else
    echo "❌ Error: Database migration failed"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "🚨 Production deployment failed. Consider rollback if needed."
        echo "   To rollback, restore from: backups/backup_${ENVIRONMENT}_${TIMESTAMP}.sql"
    fi
    exit 1
fi