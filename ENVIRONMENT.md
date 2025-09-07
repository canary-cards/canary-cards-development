# Multi-Environment Configuration

This application supports seamless deployment across staging and production environments with automatic environment detection.

## How It Works

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

## Edge Function Configuration

All Edge Functions are configured as public (no JWT required) in `supabase/config.toml`:
```toml
[functions.function-name]
verify_jwt = false
```

This allows frontend calls without authentication headers while maintaining security through API keys and request validation.
