# 🚀 Canary Cards Deployment Guide

## Complete Production Deployment System

### Architecture Overview
```
Lovable (main branch) → staging.canary.cards → realproduction branch → canary.cards
    ↓                        ↓                       ↓                    ↓
  Development            Staging Testing         Production Code      Live Production
```

### Enhanced Migration System
- **Edge Function Integration** - Secure credential management via `migration-helper` 
- **Intelligent Detection** - Automatically detects empty vs populated databases
- **Complete Safety** - Backup, rollback, and validation at every step
- **One-Click Deployment** - Supabase Dashboard integration for non-technical users
- **RLS Policy Sync** - 1-to-1 policy transfer between staging and production
- **Backfill Framework** - Handles data migrations and transformations safely

## Commands

```bash
# 🚀 Enhanced Production Deployment (Recommended)
npm run migrate:production:enhanced    # Complete production deployment with Edge Function integration

# 🔍 Analysis & Safety  
npm run migration:review              # Review migrations for safety issues
npm run backfill:detect staging      # Detect backfill needs in staging
npm run backfill:detect production   # Detect backfill needs in production

# 🔒 RLS Policy Management
npm run sync:rls-policies            # Synchronize RLS policies to production

# 📊 Data Migration Framework
npm run backfill:template my_migration  # Create data migration template
npm run backfill:execute my_migration staging    # Execute data migration (staging)
npm run backfill:execute my_migration production # Execute data migration (production)
npm run backfill:validate staging              # Validate data integrity

# 📋 Dashboard Integration
# Use Supabase SQL Editor with these functions:
# - SELECT trigger_production_migration();
# - SELECT validate_production_environment();
# - SELECT * FROM deployment_dashboard;

# 🔧 Legacy Commands (Still Available)
npm run migrate:staging              # Deploy to staging database  
npm run migrate:production           # Deploy to production database (basic)
npm run sync:functions-policies      # Deploy functions & policies only

# 📊 Utilities
npm run db:status                    # Check local Supabase status
npm run deploy:help                  # Show detailed command help
```

## Complete Production Deployment Workflow

### 🧪 Stage 1: Development & Testing (Lovable → staging.canary.cards)
1. **Make changes in Lovable** on the `main` branch
2. **Automatic Vercel deployment** to staging.canary.cards
3. **Test thoroughly** in staging environment
4. **Run migrations if needed**: `npm run migrate:staging`

### 🔍 Stage 2: Pre-Production Analysis  
1. **Review migrations**: `npm run migration:review`
2. **Check backfill needs**: `npm run backfill:detect production`
3. **Create data migrations if needed**: `npm run backfill:template migration_name`
4. **Test data migrations in staging first**: `npm run backfill:execute migration_name staging`

### 🚀 Stage 3: Production Deployment (main → realproduction → canary.cards)
1. **Create PR**: `main` → `realproduction` branch
2. **Review and merge** the PR  
3. **Automatic Vercel deployment** to canary.cards
4. **Deploy database changes**: `npm run migrate:production:enhanced`

### ✅ Stage 4: Post-Deployment Validation
1. **Validate environment**: Use dashboard function `SELECT validate_production_environment();`
2. **Check data integrity**: `npm run backfill:validate production` 
3. **Monitor deployment logs**: `SELECT * FROM deployment_dashboard;`

## Enhanced Migration Features

### 🔒 **Security & Safety**
- **Edge Function Credential Management** - No manual password entry
- **Intelligent Database Detection** - Handles empty and populated databases
- **Comprehensive Backups** - Full data and schema backups before changes
- **Transaction Safety** - All operations wrapped in transactions with rollback
- **RLS Policy Verification** - Ensures security policies are synchronized
- **Destructive Operation Detection** - Warns about potentially dangerous changes

### 🎯 **Automation & Integration**  
- **One-Click Dashboard Deployment** - Deploy via Supabase SQL Editor
- **Edge Function Deployment** - Automatic function deployment and verification
- **RLS Policy Synchronization** - Maintains 1-to-1 policy parity
- **Backfill Framework** - Templates and safe execution for data migrations
- **Progress Tracking** - Comprehensive logging and status monitoring

### 🔄 **Backfill & Data Migration**
- **Intelligent Detection** - Automatically finds missing or incorrect data
- **Template System** - Pre-built templates for common data migrations  
- **Safe Execution** - Backup and rollback capabilities for data changes
- **Validation Framework** - Comprehensive data integrity checks
- **Progress Logging** - Detailed logs of all data migration activities

## Dashboard Integration (One-Click Deployment)

### Using Supabase SQL Editor
Access your production Supabase dashboard and use these functions in the SQL Editor:

```sql
-- Trigger complete production deployment
SELECT trigger_production_migration();

-- Validate production environment health  
SELECT validate_production_environment();

-- Check deployment status and history
SELECT * FROM deployment_dashboard ORDER BY created_at DESC LIMIT 10;

-- Prepare migration from staging
SELECT prepare_migration_from_staging();
```

### Dashboard Benefits
- **No Command Line Required** - Perfect for non-technical team members
- **Visual Status Tracking** - See deployment progress in real-time
- **Safe Error Handling** - Built-in validation and error recovery
- **Audit Trail** - Complete history of all deployment activities

## Environment Configuration

### Vercel Project Settings
- **Production Branch**: `realproduction` 
- **Staging Branch**: `main`
- **Environment Variables**: Automatically handled by `src/lib/environment.ts`
  - staging.canary.cards uses staging Supabase project
  - canary.cards uses production Supabase project

### Supabase Secrets (Required)
- `PRODUCTION_DB_PASSWORD` - Production database password
- `STAGING_DB_PASSWORD` - Staging database password  
- `PRODUCTION_PROJECT_ID` - Production Supabase project ID
- `STAGING_PROJECT_ID` - Staging Supabase project ID

## Troubleshooting

### Common Issues
- **Migration Helper Not Found**: Ensure the `migration-helper` Edge Function is deployed
- **RLS Policy Conflicts**: Use `npm run sync:rls-policies` to resolve conflicts
- **Data Migration Failures**: Check logs in `data-migrations/logs/` directory
- **Dashboard Functions Missing**: Run `./scripts/dashboard-deploy-trigger.sql` in SQL Editor

### Emergency Procedures  
- **Schema Rollback**: Use backup files in `backups/production/`
- **Data Rollback**: Use data migration rollback scripts 
- **Function Rollback**: Redeploy previous function versions
- **Complete Reset**: Contact team for manual intervention

## Security Best Practices

- **Never Store Passwords in Code** - Use Supabase secrets only
- **Always Test in Staging First** - Never deploy untested changes
- **Backup Before Changes** - Automatic backups for all production changes
- **Monitor RLS Policies** - Ensure data access is properly restricted
- **Audit Deployment Logs** - Review all deployment activities regularly

---

**Complete, secure, and automated deployment system with maximum safety and minimal complexity.** ✨