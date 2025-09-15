# 🚀 Simple Production Deployment Guide

## Three-Command Deployment System

Your deployment is now simplified to just **3 essential commands** with comprehensive safety protection:

```bash
# 1. Setup (run once)
./setup-production-deployment.sh

# 2. Deploy (every deployment)  
./deploy-to-production.sh

# 3. Rollback (if needed)
./rollback-production.sh
```

## Quick Start

### First Time Setup
```bash
# Install prerequisites and validate access
./setup-production-deployment.sh

# Add required secrets to production
./setup-production-deployment.sh --secrets
```

### Deploy Changes
```bash
# Deploy code and database changes safely
./deploy-to-production.sh
```

### Emergency Rollback
```bash
# Rollback to previous stable state
./rollback-production.sh
```

## Enhanced Safety Features

Your deployment system includes **automatic protection** against common deployment issues:

### 🛡️ Destructive Change Protection
- **Automatic detection** of dangerous operations (DROP, TRUNCATE, DELETE)
- **Safety transforms** applied automatically (IF NOT EXISTS, CONCURRENTLY)
- **Manual review prompts** for complex changes
- **Rollback scripts** generated automatically

### 📊 Smart Migration Handling
- **Additive changes**: Deployed automatically with safety checks
- **Type changes**: Validates data compatibility first
- **Column renames**: Provides safe transformation options
- **Complex changes**: Generates custom migration templates

### 🔄 Comprehensive Rollback
- **Automated backup creation** before every deployment
- **One-command rollback** to previous stable state
- **Validation checks** before and after rollback
- **Recovery procedures** for edge cases

## Handling Different Types of Changes

### Simple Changes (Tables, Columns, Functions)
```bash
./deploy-to-production.sh
# ✅ Automatically detects and deploys safely
```

### Complex Changes (Renames, Type Changes)
When the deployment script detects complex changes:

```bash
./deploy-to-production.sh
# Output:
# ⚠️  COMPLEX CHANGES DETECTED:
# • ALTER COLUMN type change (may affect existing data)
# 
# Options:
# 1. Continue with automatic safety transforms
# 2. Generate custom migration for review
# 3. Cancel deployment
```

**Choose Option 2** for maximum safety on complex changes.

### Emergency Situations
```bash
./rollback-production.sh
# Type 'ROLLBACK' to confirm
# ✅ Complete system rollback in under 2 minutes
```

## Environment Architecture

```
Lovable (main) → staging.canary.cards → realproduction → canary.cards
     ↓                    ↓                      ↓              ↓
Development         Auto-deployed         Production      Live Site
```

### Deployment Flow
1. **Development**: Make changes in Lovable on `main` branch
2. **Staging**: Automatic deployment to staging.canary.cards
3. **Testing**: Validate changes in staging environment
4. **Production**: Run `./deploy-to-production.sh` to deploy to canary.cards

## Project Configuration

### Required Secrets (Production Supabase Project)
Use `./setup-production-deployment.sh --secrets` to see the complete list.

**Core Requirements:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (payments)
- `RESEND_API_KEY` (emails)
- API keys for external services (Geocoding, AI services, etc.)

### Branch Configuration
- **Production Branch**: `realproduction` (auto-managed)
- **Staging Branch**: `main` (your working branch)
- **Environment Detection**: Automatic via hostname

## Troubleshooting

### Common Issues

**"Migration failed" Error**
```bash
# Automatic rollback is available
./rollback-production.sh
```

**"Destructive changes detected" Warning**
- Review changes carefully
- Choose safety transforms when offered
- Generate custom migration for complex cases

**"API not responding" After Deployment**
- Edge functions may need a few minutes to activate
- Check Supabase dashboard for function status

### Emergency Procedures

**Complete System Failure**
1. `./rollback-production.sh` (fastest recovery)
2. Check backups in `backups/database/`
3. Use rollback scripts in `backups/rollback-scripts/`

**Partial Deployment Issues**
- Database issues: Automatic rollback available
- Function issues: Redeploy functions only
- Code issues: Git rollback to previous commit

## Monitoring & Validation

### Post-Deployment Checks
- Production site: https://canary.cards
- Supabase Dashboard: https://supabase.com/dashboard/project/xwsgyxlvxntgpochonwe
- Function Logs: Monitor for errors in first 10 minutes

### Success Indicators
- ✅ Site loads correctly
- ✅ Database operations work
- ✅ Payment flow functional
- ✅ API endpoints responsive

## Advanced Usage

### For Complex Database Changes
```bash
# Generate custom migration with safety features
./generate-migration.sh "description of changes"

# Review generated migration file
# Edit if needed, then deploy
./deploy-to-production.sh
```

### Multiple Environment Management
The system automatically handles:
- **staging.canary.cards**: Uses staging Supabase project
- **canary.cards**: Uses production Supabase project
- ***.lovable.app**: Uses staging configuration

## Security Best Practices

- ✅ **Never store secrets in code** - Use Supabase secrets only
- ✅ **Always test in staging first** - No exceptions
- ✅ **Backup before changes** - Automatic with every deployment
- ✅ **Monitor after deployment** - Check logs for 10 minutes
- ✅ **Use rollback when unsure** - Better safe than sorry

---

## Summary

**Your deployment system is now:**
- **Simple**: 3 commands for all scenarios
- **Safe**: Automatic protection against data loss
- **Fast**: Typical deployment under 5 minutes  
- **Reliable**: Comprehensive rollback capabilities
- **Smart**: Detects and handles complex changes automatically

**Need help?** All scripts include detailed output and guidance for every situation.

✨ **Deploy with confidence!**