# 🔒 Production-Safe Migration Workflow

This document outlines the complete process for safely managing schema changes between staging and production databases when you have production data.

## ⚠️ Important: Never Use Direct Schema Sync with Production Data

**DON'T:** Use `sync:staging-to-prod:enhanced` when you have production data  
**DO:** Use the migration-based workflow below

## 🚀 The Complete Workflow

### 1. Development Phase (Staging)
```bash
# Make your schema changes in staging environment
# Test thoroughly with staging data
# Ensure your application works with the new schema
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

### 4. Deploy to Production Safely
```bash
npm run migrate:production:safe
```

**What this does:**
- Creates full database backup (data + schema)
- Uses transactional deployment
- Provides rollback scripts
- Validates before and after deployment
- Maintains data integrity

## 📋 Migration Safety Checklist

Before deploying any migration to production:

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

## 🔧 Available Commands

### Production-Safe Migration Workflow
```bash
npm run migration:generate [description]  # Generate migration from staging
npm run migration:review                  # Review migrations for safety
npm run migrate:production:safe           # Deploy to production safely
```

### Development Commands
```bash
npm run migrate:staging                   # Deploy to staging
npm run sync:staging-to-prod:enhanced     # Emergency schema sync (no prod data!)
npm run db:status                        # Check database status
npm run deploy:help                      # Show all commands
```

## 🛠️ Example Workflow

### Adding a New Feature

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

4. **Deploy to production:**
```bash
npm run migrate:production:safe
# Creates backups, applies migration, verifies success
```

## 🆘 Emergency Procedures

### If Migration Fails
1. **Don't panic** - your data is backed up
2. Check the rollback script in `backups/production/rollback_[timestamp].sql`
3. Use the backup files to restore if needed:
```bash
psql [PRODUCTION_URL] -f backups/production/backup_full_[timestamp].sql
```

### If You Need to Rollback
```bash
# Restore from backup (replace [timestamp] with actual)
psql [PRODUCTION_URL] -f backups/production/backup_schema_[timestamp].sql
```

## 🔐 Security Best Practices

1. **Always backup before migrations**
2. **Never skip the review step**
3. **Test migrations on staging copy first**
4. **Use transactions for complex migrations**
5. **Monitor production after deployment**
6. **Keep rollback plans ready**
7. **Document all schema changes**

## 📁 File Structure

```
scripts/
├── generate-migration.sh       # Creates production-safe migrations
├── migration-review.sh         # Reviews migrations for safety
├── migrate-production-safe.sh  # Deploys with maximum safety
└── sync-staging-to-prod-enhanced.sh  # Emergency sync (no prod data!)

supabase/migrations/
├── [timestamp]_migration_name.sql  # Your migration files
└── ...

backups/production/
├── backup_full_[timestamp].sql     # Complete database backups
├── backup_schema_[timestamp].sql   # Schema-only backups
└── rollback_[timestamp].sql        # Generated rollback scripts
```

## 🎯 Key Benefits

- **Data Safety:** Never lose production data
- **Rollback Capability:** Always have a way back
- **Automation:** Scripts handle safety checks
- **Transparency:** See exactly what will change
- **Reliability:** Proven workflow for schema evolution

---

**Remember:** When in doubt, create a backup and test on staging first! 🔒