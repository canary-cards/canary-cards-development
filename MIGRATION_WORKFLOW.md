# 🔒 Complete Production-Safe Migration Workflow

This document outlines the complete process for safely managing **schema changes, Edge Functions, and RLS policies** between staging and production databases when you have production data.

## ⚠️ Critical: Migration Scripts Handle More Than Just Schema

**Previous Issue:** Early migration scripts only handled schema (tables, columns, enums) but missed:
- ❌ **Edge Functions** (API endpoints)  
- ❌ **RLS Policies** (Row Level Security - data access rules)
- ❌ **This caused data saving failures in production!**

**Solution:** Enhanced workflow now handles **ALL components** required for production parity.

## ⚠️ Important: Never Use Direct Schema Sync with Production Data

**DON'T:** Use `sync:staging-to-prod:enhanced` when you have production data  
**DO:** Use the complete migration-based workflow below

## 🚀 The Complete Production Deployment Workflow

### 1. Development Phase (Staging)
```bash
# Make your schema changes in staging environment
# Add/modify Edge Functions as needed
# Update RLS policies if required
# Test thoroughly with staging data
# Ensure your application works completely (data saving, API calls, etc.)
```

### 2. Generate Production-Safe Migration
```bash
npm run migration:generate "add user preferences table"
```

**What this does:**
- Connects to staging database
- Analyzes differences between local migrations and staging
- Creates a production-safe migration file
- Automatically adds `IF NOT EXISTS` clauses
- Comments out potentially destructive operations
- Provides safety checklist

### 3. Review Migration for Safety
```bash
npm run migration:review
```

**What this does:**
- Scans all pending migrations
- Identifies dangerous operations (DROP, TRUNCATE, DELETE)
- Flags missing safety patterns
- Provides deployment recommendations
- Must show "SAFE TO DEPLOY" before proceeding

### 4. Deploy Schema to Production Safely
```bash
npm run migrate:production:safe
```

**What this does:**
- Creates full database backup (data + schema)
- Uses transactional deployment
- Provides rollback scripts
- Validates before and after deployment
- Maintains data integrity

### 5. Deploy Functions and Policies (CRITICAL!)
```bash
npm run sync:functions-policies
```

**What this does:**
- Deploys all Edge Functions to production (API endpoints)
- Applies missing RLS (Row Level Security) policies (data access rules)
- Ensures data saving/access works properly
- Verifies functions are active and policies are applied

**⚠️ Why This Step is Critical:**
- **Without Edge Functions:** API calls fail, no backend functionality
- **Without RLS Policies:** Supabase blocks all data operations by default for security
- **This step ensures production works exactly like staging**

## 📋 Complete Production Deployment Checklist

Before deploying any changes to production:

### Schema Migration Safety

### ✅ Safe Operations
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN IF NOT EXISTS` (with nullable or default)
- `CREATE INDEX CONCURRENTLY IF NOT EXISTS`
- `CREATE TYPE` (new enums)
- `ALTER TYPE ADD VALUE` (enum values)
- `CREATE FUNCTION`
- `INSERT INTO` (data seeding)

### ⚠️ Use With Caution
- `ALTER TABLE ALTER COLUMN TYPE` (may require data conversion)
- `CREATE INDEX` without `CONCURRENTLY` (locks table)
- `ALTER TABLE ADD CONSTRAINT` (validate existing data first)
- Large data updates

### ❌ Dangerous Operations (Avoid)
- `DROP TABLE` (data loss)
- `DROP COLUMN` (data loss)  
- `TRUNCATE` (data loss)
- `DELETE FROM` (data loss)
- `ALTER TYPE DROP VALUE` (may break existing data)

### Functions and Policies Safety

### ✅ Safe Operations
- Deploy new Edge Functions
- Add new RLS policies
- Enable RLS on new tables
- Grant additional permissions

### ⚠️ Use With Caution
- Modify existing RLS policies (may affect data access)
- Change function signatures (may break API calls)
- Revoke permissions (may break application functionality)

### ❌ Dangerous Operations (Avoid)
- Delete Edge Functions (breaks API endpoints)
- Drop RLS policies (removes data protection)
- Disable RLS on tables with data (security risk)

## 🔧 Available Commands

### Production-Safe Migration Workflow
```bash
npm run migration:generate [description]  # Generate migration from staging
npm run migration:review                  # Review migrations for safety
npm run migrate:production:safe           # Deploy schema to production safely
npm run sync:functions-policies           # Deploy functions & RLS policies
```

### Development Commands
```bash
npm run migrate:staging                   # Deploy to staging
npm run sync:staging-to-prod:enhanced     # Emergency schema sync (no prod data!)
npm run db:status                        # Check database status
npm run deploy:help                      # Show all commands
```

### Functions and Policies
```bash
npm run sync:functions-policies           # Deploy functions & RLS policies
```

## 🛠️ Complete Example Workflows

### Example 1: Adding a New Feature with Database Changes

1. **Develop in staging:**
```bash
# In staging, create new table via Supabase dashboard or SQL
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  theme text DEFAULT 'light',
  created_at timestamptz DEFAULT now()
);
```

2. **Generate migration:**
```bash
npm run migration:generate "add user preferences table"
# Creates: supabase/migrations/20231201120000_add_user_preferences_table.sql
```

3. **Review generated migration:**
```bash
npm run migration:review
# Output: ✅ SAFE TO DEPLOY - No dangerous operations found
```

4. **Deploy schema to production:**
```bash
npm run migrate:production:safe
# Creates backups, applies migration, verifies success
```

5. **Deploy functions and policies:**
```bash
npm run sync:functions-policies
# Deploys Edge Functions and RLS policies
```

### Example 2: Deploying Only Function/Policy Changes

If you only changed Edge Functions or RLS policies (no schema changes):

1. **Test in staging thoroughly**
2. **Deploy functions and policies:**
```bash
npm run sync:functions-policies
# Deploys all functions and applies missing policies
```
3. **Verify production functionality**

### Example 3: Emergency Schema Sync (No Production Data)

If you have NO production data and need to quickly sync everything:

```bash
npm run sync:staging-to-prod:enhanced
# ⚠️ ONLY use when production has no important data!
```

## 🆘 Emergency Procedures

### If Schema Migration Fails
1. **Don't panic** - your data is backed up
2. Check the rollback script in `backups/production/rollback_[timestamp].sql`
3. Use the backup files to restore if needed:
```bash
psql [PRODUCTION_URL] -f backups/production/backup_full_[timestamp].sql
```

### If Functions/Policies Deployment Fails
1. **Functions are safe to redeploy** - they don't affect data
2. **RLS policies failures** - check for naming conflicts
3. **Retry deployment:**
```bash
npm run sync:functions-policies
```

### If Data Saving Still Doesn't Work
1. **Check RLS policies are applied:**
```bash
# Connect to production and check policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```
2. **Verify Edge Functions are active:**
   - Check Supabase Dashboard → Functions
   - Look for "ACTIVE" status on all functions
3. **Common issues:**
   - Missing `service_role` policies
   - RLS not enabled on tables
   - Functions deployed but not active

### If You Need to Rollback
```bash
# Restore schema from backup (replace [timestamp] with actual)
psql [PRODUCTION_URL] -f backups/production/backup_schema_[timestamp].sql

# Redeploy functions and policies after rollback
npm run sync:functions-policies
```

## 🔐 Security Best Practices

1. **Always backup before migrations**
2. **Never skip the migration review step**
3. **Test complete workflow on staging copy first**
4. **Use transactions for complex migrations**
5. **Always deploy functions and policies after schema changes**
6. **Monitor production after deployment**
7. **Keep rollback plans ready**
8. **Document all changes (schema, functions, policies)**
9. **Verify data saving works after deployment**
10. **Never disable RLS on tables with production data**

## 📁 File Structure

```
scripts/
├── generate-migration.sh              # Creates production-safe migrations
├── migration-review.sh                # Reviews migrations for safety
├── migrate-production-safe.sh         # Deploys schema with maximum safety
├── sync-functions-and-policies.sh     # Deploys functions & RLS policies
└── sync-staging-to-prod-enhanced.sh   # Emergency sync (no prod data!)

supabase/
├── functions/                         # Edge Functions (API endpoints)
│   ├── create-payment/
│   ├── postcard-draft/
│   └── ...
├── migrations/                        # Database schema migrations
│   ├── [timestamp]_migration_name.sql
│   └── [timestamp]_critical_rls_policies_fix.sql
└── config.toml                       # Supabase configuration

backups/production/
├── backup_full_[timestamp].sql        # Complete database backups
├── backup_schema_[timestamp].sql      # Schema-only backups
└── rollback_[timestamp].sql           # Generated rollback scripts
```

## 🎯 Key Benefits

- **Complete Coverage:** Handles schema, functions, AND policies
- **Data Safety:** Never lose production data
- **Functional Parity:** Production works exactly like staging
- **Rollback Capability:** Always have a way back
- **Automation:** Scripts handle safety checks
- **Transparency:** See exactly what will change
- **Reliability:** Proven workflow for complete production deployment

## 🔍 Troubleshooting Common Issues

### "Data Not Saving" in Production
**Most likely cause:** Missing RLS policies
**Solution:** Run `npm run sync:functions-policies`

### "API Endpoints Not Working" in Production  
**Most likely cause:** Missing Edge Functions
**Solution:** Run `npm run sync:functions-policies`

### "Permission Denied" Errors
**Most likely cause:** Restrictive RLS policies or missing service_role access
**Solution:** Check and update RLS policies for proper access patterns

### Schema Applied But App Broken
**Most likely cause:** Missing functions and policies step
**Solution:** Always run both steps:
1. `npm run migrate:production:safe` (schema)
2. `npm run sync:functions-policies` (functions & policies)

---

**Remember:** The complete workflow includes BOTH schema AND functions/policies deployment! 🔒