# Multi-Environment Configuration

This application supports seamless deployment across staging and production environments with automatic environment detection.

## Architecture Overview

### Multi-Project Setup
This system uses a **two-project architecture**:
- **Staging Project** (`pugnjgvdisdbdkbofwrc`): Connected to this Lovable project for development
- **Production Project** (`xwsgyxlvxntgpochonwe`): Separate Supabase project for live production

### Frontend Environment Detection
The application automatically detects the environment based on the hostname:

- **Production**: `canary.cards` and `www.canary.cards`
  - Uses production Supabase project: `xwsgyxlvxntgpochonwe`
- **Staging**: `lovable.app` and `*.lovable.app` 
  - Uses staging Supabase project: `pugnjgvdisdbdkbofwrc`

### Configuration Location
Environment configuration is managed in `/src/lib/environment.ts`:
```typescript
const environments = {
  'canary.cards': {
    supabaseUrl: 'https://xwsgyxlvxntgpochonwe.supabase.co',
    supabaseAnonKey: '...',
    frontendUrl: 'https://canary.cards',
    isProduction: true,
  },
  // ... other environments
}
```

### Edge Functions
All Edge Functions use environment variables instead of hard-coded values:
- `SUPABASE_URL` - Automatically set by Supabase
- `SUPABASE_ANON_KEY` - Automatically set by Supabase  
- `FRONTEND_URL` - Set manually for link generation in emails
- API keys like `Google`, `IgnitePostAPI`, `OPENAI_API_KEY`, etc.

## Required Secrets Per Environment

Both staging and production Supabase projects need these secrets configured:

### Core Infrastructure
- `SUPABASE_URL` (auto-configured)
- `SUPABASE_ANON_KEY` (auto-configured) 
- `SUPABASE_SERVICE_ROLE_KEY` (auto-configured)
- `FRONTEND_URL` (set to domain: `https://canary.cards` or `https://lovable.app`)

### Third-Party APIs
- `Google` - Google Places API key
- `GeoCodioKey` - Geocodio API for representative lookup
- `IgnitePostAPI` - IgnitePost API for postcard sending
- `STRIPE_SECRET_KEY` - Stripe payments
- `RESEND_API_KEY` - Email sending
- `EMAIL_LOGO_URL` - Direct URL to logo for emails

### AI & Content
- `OPENAI_API_KEY` - OpenAI for transcription
- `ANTHROPIC_API_KEY_1` through `ANTHROPIC_API_KEY_5` - Anthropic Claude API
- `CONGRESS_API_KEY` - Congress.gov API
- `GUARDIAN_API_KEY` - Guardian newspaper API  
- `NYT_API_KEY` - New York Times API
- `PERPLEXITY_API_KEY` - Perplexity API

## Deployment Process

1. **Code Changes**: Make changes in this codebase
2. **Staging Test**: Test on Lovable preview (staging environment)
3. **Production Deploy**: Deploy to production domain (automatic environment switch)

No manual configuration changes needed - the environment is detected automatically!

## Production Migration System

### How Production Deployment Works
The production migration system uses the **staging environment as a secure bridge** to deploy changes to production:

1. **Migration Helper Edge Function**: Runs in staging, securely accesses production credentials
2. **Secure Credential Storage**: Production database credentials are stored as secrets in the staging project
3. **Cross-Project Migration**: The staging environment orchestrates schema changes and deployments to production

### Why Production Credentials Are Stored in Staging
- **Security**: No production secrets stored in code or local environments
- **Centralized Management**: All deployment logic runs from the staging environment
- **Audit Trail**: All production changes logged through the staging system

### Required Migration Secrets (Stored in Staging Project)
These secrets must be configured in the **staging Supabase project** for production migrations:

#### Production Database Access
- `PRODUCTION_PROJECT_ID`: Production Supabase project ID (`xwsgyxlvxntgpochonwe`)
- `PRODUCTION_DB_URL`: Full PostgreSQL connection string for production database
- `PRODUCTION_DB_PASSWORD`: Production database password
- `PRODUCTION_SUPABASE_ANON_KEY`: Production project anon key
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`: Production project service role key

#### Staging Database Access (for comparison)
- `STAGING_PROJECT_ID`: Staging Supabase project ID (`pugnjgvdisdbdkbofwrc`)
- `STAGING_DB_URL`: Full PostgreSQL connection string for staging database
- `STAGING_DB_PASSWORD`: Staging database password
- `STAGING_SUPABASE_ANON_KEY`: Staging project anon key (already configured)
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`: Staging project service role key

### Migration Script Workflow
1. **Connect to Staging**: Script connects to staging environment
2. **Invoke Migration Helper**: Calls Edge Function to get production credentials
3. **Generate Schema Diff**: Compares staging vs production database schemas
4. **Apply Changes**: Deploys migrations and Edge Functions to production
5. **Verify Deployment**: Confirms successful migration and RLS policy sync

### Troubleshooting Migration Issues
- **Connection Timeout**: Usually indicates missing production credentials in staging
- **Authentication Failed**: Check that production service role key is correct
- **Migration Helper Error**: Verify all required secrets are configured in staging project

## Edge Function Configuration

All Edge Functions are configured as public (no JWT required) in `supabase/config.toml`:
```toml
[functions.function-name]
verify_jwt = false
```

This allows frontend calls without authentication headers while maintaining security through API keys and request validation.
