# 🚀 Canary Cards Deployment Guide

## Quick Start

### Vercel handles all deployments automatically:
- **Push to `main`** → Deploys to staging.canary.cards
- **Merge `main` → `realproduction`** → Deploys to canary.cards

### Database migrations are manual and elegant:
- **Staging**: `npm run migrate:staging`
- **Production**: `npm run migrate:production`

## Commands

```bash
# Deployment help
npm run deploy:help

# Database migrations
npm run migrate:staging      # Deploy to staging database
npm run migrate:production   # Deploy to production database (with confirmation + backup)

# Utilities
npm run db:status           # Check local Supabase status
```

## Deployment Flow

### 🧪 Staging Deployment
1. **Push to `main` branch**
2. **Vercel automatically deploys** to staging.canary.cards
3. **Run migrations when needed**: `npm run migrate:staging`

### 🚀 Production Deployment  
1. **Create PR**: `main` → `realproduction`
2. **Review and merge** the PR
3. **Vercel automatically deploys** to canary.cards  
4. **Run migrations when needed**: `npm run migrate:production`

## Database Migration Features

✨ **Elegant & Safe**
- 🎨 **Colorful output** with clear status
- 🔒 **Production confirmation** required
- 📦 **Automatic backups** for production
- 🔍 **Schema verification** after migration
- ⚡ **Simple commands** - no complex setup needed

## Environment Setup

### Vercel Project Settings
- **Production Branch**: `realproduction`
- **Environment Variables**: 
  - `VITE_SUPABASE_URL` (different for staging/production)
  - `VITE_SUPABASE_ANON_KEY` (different for staging/production)

That's it! Simple, elegant, and reliable. ✨