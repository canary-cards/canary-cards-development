# Canary Cards Deployment Guide

This document explains the deployment setup and processes for Canary Cards.

## Environment Overview

- **Staging**: `main` branch → `staging.canary.cards` (Vercel)
- **Production**: `realproduction` branch → `canary.cards` (Vercel)
- **Databases**: 
  - Staging: "Canary Cards Staging" (Supabase)
  - Production: "Canary Cards Prod" (Supabase)

## Quick Start

### 1. Initial Setup

You'll need to configure these secrets in your GitHub repository:

**GitHub Repository Settings > Secrets and Variables > Actions:**

```
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
SUPABASE_STAGING_PROJECT_ID=your_staging_project_id
SUPABASE_PROD_PROJECT_ID=your_production_project_id
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_STAGING_PROJECT_ID=your_vercel_staging_project_id
VERCEL_PROD_PROJECT_ID=your_vercel_production_project_id
```

### 2. Getting Your Secrets

#### Supabase Secrets:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. **Access Token**: Account Settings > Access Tokens > Create new token
3. **Project IDs**: 
   - Staging: Project Settings > General > Reference ID
   - Production: Project Settings > General > Reference ID

#### Vercel Secrets:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. **Token**: Settings > Tokens > Create new token
3. **Org ID**: Settings > General > Team ID
4. **Project IDs**: Project Settings > General > Project ID

## Deployment Workflows

### Staging Deployment (Automatic)
- **Trigger**: Push to `main` branch
- **Target**: `staging.canary.cards`
- **Database**: Automatically runs migrations on staging database
- **Process**: Build → Test → Deploy → Migrate DB

### Production Deployment (Manual)

#### Option 1: Using GitHub Actions (Recommended)
1. Go to Actions tab in your repository
2. Run "Promote to Production" workflow
3. This creates a PR from `main` → `realproduction`
4. Review the PR and merge when ready
5. Deployment runs automatically on merge

#### Option 2: Manual PR Creation
```bash
# Create and push a new branch
git checkout main
git pull origin main
git checkout -b promote-to-prod-$(date +%Y%m%d)
git push origin promote-to-prod-$(date +%Y%m%d)

# Create PR via GitHub UI: promote-to-prod-YYYYMMDD → realproduction
```

#### Option 3: Direct Workflow Trigger
- Go to Actions > "Deploy to Production"
- Click "Run workflow"
- Optionally skip database migrations

## Database Migrations

### Automatic Migration (Default)
All deployments automatically run database migrations using:
```bash
supabase db push --project-id $PROJECT_ID
```

### Manual Migration
You can run migrations manually using the provided script:

```bash
# For staging
SUPABASE_STAGING_PROJECT_ID=your_project_id ./scripts/deploy-migrations.sh staging

# For production (creates automatic backup)
SUPABASE_PROD_PROJECT_ID=your_project_id ./scripts/deploy-migrations.sh production
```

### Migration Safety
- **Staging**: Migrations run automatically on every deployment
- **Production**: 
  - Automatic database backup created before migration
  - Migrations can be skipped via workflow input
  - Schema verification runs after migration

## Local Development

Run the setup script:
```bash
./scripts/setup-local.sh
```

This will:
1. Install dependencies
2. Set up environment variables
3. Let you choose which database to connect to
4. Provide next steps

## Environment Variables

Create `.env.local` for local development:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration  
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key

# App Configuration
VITE_APP_URL=http://localhost:5173
VITE_ENVIRONMENT=development
```

## Vercel Configuration

The project includes:
- `vercel.json` - Main Vercel configuration
- Automatic deployments for both staging and production
- SPA routing support
- CORS headers for API routes

### Vercel Project Setup
1. Connect your GitHub repository to Vercel
2. Create two projects:
   - **Staging**: Connected to `main` branch → `staging.canary.cards`
   - **Production**: Connected to `realproduction` branch → `canary.cards`
3. Configure environment variables in each project

## Troubleshooting

### Common Issues

#### Database Migration Failures
```bash
# Check migration status
supabase db diff --project-id your_project_id

# Manual rollback (production only)
# Restore from backup created in backups/ directory
```

#### Vercel Deployment Failures
- Check build logs in Vercel dashboard
- Verify environment variables are set
- Ensure `npm run build` works locally

#### GitHub Actions Failures
- Check Actions tab for detailed logs
- Verify all secrets are configured
- Ensure branch protection rules allow merging

### Emergency Procedures

#### Production Rollback
1. Revert the problematic commit in `realproduction`
2. Push the revert
3. Vercel will automatically redeploy
4. For database issues, restore from backup in `backups/` directory

#### Staging Issues
1. Fix issues in `main` branch
2. Push changes
3. Automatic deployment will occur

## Security Notes

- Never commit secrets to repository
- Use environment variables for all sensitive data
- Production database backups are created automatically
- All API keys should have minimal required permissions

## Monitoring

- Monitor deployments in Vercel dashboard
- Check GitHub Actions for workflow status
- Monitor database performance in Supabase dashboard
- Set up alerts for deployment failures