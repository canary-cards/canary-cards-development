# 🛡️ Deployment Safety Guide

## Overview

Your deployment system includes **comprehensive safety features** to protect against data loss and service disruption. This guide explains when manual intervention might be needed and how to handle complex scenarios safely.

## Automatic Safety Features

### 🔍 Destructive Change Detection
The system automatically identifies dangerous operations:

- **DROP TABLE/COLUMN** - Could cause permanent data loss
- **TRUNCATE/DELETE FROM** - Could remove production data  
- **ALTER TYPE** - May incompatible with existing data
- **ADD CONSTRAINT NOT NULL** - May fail on existing data

### 🛡️ Automatic Protection Applied
When safe operations are detected:

- **CREATE statements** → Adds `IF NOT EXISTS`
- **INDEX creation** → Adds `CONCURRENTLY IF NOT EXISTS`  
- **ADD COLUMN** → Ensures nullable or has default value
- **Dangerous operations** → Commented out for manual review

### 💾 Comprehensive Backup Strategy
Before every deployment:

- **Full database dump** (schema + data)
- **Rollback scripts** generated automatically
- **30-day backup retention** for safety
- **Backup validation** before proceeding

## When Manual Intervention is Needed

### Scenario 1: Column Renames
**Problem**: You need to rename `first_name` to `full_name`

**Automatic Detection**:
```bash
./deploy-to-production.sh
# Output:
# ⚠️ DESTRUCTIVE OPERATIONS detected (DROP, ALTER)
# Options: [1] Cancel [2] Safety transforms [3] Custom migration
```

**Best Practice**: Choose option 3 (Custom migration)

**Safe Manual Process**:
```bash
./generate-migration.sh "rename first_name to full_name safely"
```

Edit the generated migration:
```sql
-- Safe column rename process
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;
UPDATE users SET full_name = first_name WHERE full_name IS NULL;
-- Leave old column for now (can be dropped in future migration after verification)
-- DROP COLUMN first_name; -- Commented for safety
```

### Scenario 2: Data Type Changes
**Problem**: Change `age` from `text` to `integer`

**Automatic Detection**:
```bash
# System detects type conversion needed
# Prompts for data validation approach
```

**Safe Manual Process**:
```sql
-- Add new column with correct type
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_int integer;

-- Migrate data with validation
UPDATE users 
SET age_int = CASE 
    WHEN age ~ '^[0-9]+$' THEN age::integer 
    ELSE NULL 
END
WHERE age_int IS NULL;

-- Verify data migration success
-- DROP COLUMN age; -- Leave old column commented for safety
```

### Scenario 3: Complex Table Restructuring
**Problem**: Split `address` into `street`, `city`, `state`

**Best Practice**: Use staged approach

**Stage 1**: Add new columns
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state text;
```

**Stage 2**: Migrate data (separate deployment)
```sql
-- Parse existing address field
UPDATE users SET 
    street = split_part(address, ',', 1),
    city = split_part(address, ',', 2),
    state = split_part(address, ',', 3)
WHERE street IS NULL;
```

**Stage 3**: Remove old column (after validation)
```sql
-- Only after confirming data migration success
-- ALTER TABLE users DROP COLUMN address;
```

## Understanding Safety Prompts

### Prompt: "Destructive Changes Detected"
```bash
🚨 DESTRUCTIVE OPERATIONS detected:
• DROP COLUMN users.old_email (potential data loss)
• ALTER TYPE user_role (may affect existing data)

Options:
1. Cancel deployment and review changes manually
2. Continue with automatic safety transforms  
3. Generate custom migration for manual review
```

**Recommendation by Change Type**:
- **Simple drops**: Choose option 2 (safety transforms comment them out)
- **Type changes**: Choose option 3 (custom migration)
- **Complex restructuring**: Choose option 1 (manual planning needed)

### Prompt: "Type Change Validation Required"
```bash
⚠️ TYPE CHANGES detected:
• Column 'amount' changing from text to numeric
• Existing data validation required

Validation options:
1. Proceed (assumes all data is compatible)
2. Validate data first (recommended)
3. Create staged migration
```

**Always choose option 2 or 3** for production safety.

## Advanced Safety Techniques

### Data Validation Before Type Changes
```sql
-- Validate numeric conversion
SELECT id, amount, 
       CASE WHEN amount ~ '^[0-9.]+$' THEN 'VALID' ELSE 'INVALID' END as status
FROM orders 
WHERE amount ~ '^[^0-9.]';

-- Only proceed if no INVALID rows
```

### Safe Constraint Addition
```sql
-- Check existing data first
SELECT COUNT(*) FROM users WHERE email IS NULL;
-- If count > 0, clean data first

-- Add constraint safely
ALTER TABLE users ADD CONSTRAINT users_email_not_null 
CHECK (email IS NOT NULL) NOT VALID;

-- Validate constraint
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;
```

### Safe Index Creation on Large Tables
```sql
-- Use CONCURRENTLY to avoid table locks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users (email);
```

## Rollback Procedures

### Automatic Rollback Triggers
The system automatically rolls back when:

- Migration SQL execution fails
- Post-deployment validation fails
- Critical service health checks fail

### Manual Rollback Decision Points
Consider manual rollback when:

- **Data appears incorrect** after deployment
- **Performance significantly degraded**
- **Critical functionality broken**
- **User reports data inconsistencies**

### Rollback Process
```bash
./rollback-production.sh
# Type 'ROLLBACK' when prompted
# System restores database and code to previous state
```

## Monitoring & Validation

### Post-Deployment Checks
After any deployment, monitor:

1. **Application functionality** (5 minutes)
2. **Database performance** (10 minutes)  
3. **Error logs** (15 minutes)
4. **User-reported issues** (24 hours)

### Validation Queries
```sql
-- Check data integrity
SELECT COUNT(*) FROM critical_table;

-- Verify relationships
SELECT COUNT(*) FROM orders o 
LEFT JOIN customers c ON o.customer_id = c.id 
WHERE c.id IS NULL;

-- Performance check
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

## Emergency Response

### Data Loss Prevention
**If you suspect data loss**:

1. **Stop all deployments immediately**
2. **Run rollback**: `./rollback-production.sh` 
3. **Verify data restoration**
4. **Investigate root cause offline**

### Service Disruption Response
**If site is down after deployment**:

1. **Check obvious issues** (DNS, Vercel deployment)
2. **If database-related**: `./rollback-production.sh`
3. **Monitor recovery progress** 
4. **Communicate with users if needed**

## Best Practices Summary

### Pre-Deployment
- ✅ **Test all changes in staging thoroughly**
- ✅ **Review migration files manually**
- ✅ **Plan rollback strategy for complex changes**
- ✅ **Validate data compatibility for type changes**

### During Deployment  
- ✅ **Read and understand all safety prompts**
- ✅ **Choose conservative options when uncertain**
- ✅ **Monitor deployment progress actively**
- ✅ **Have rollback command ready**

### Post-Deployment
- ✅ **Validate critical functionality immediately**
- ✅ **Monitor logs for errors**
- ✅ **Keep backup files until verified stable**
- ✅ **Document lessons learned**

### Emergency Situations
- ✅ **Act quickly but deliberately**
- ✅ **Use rollback for data-related issues**  
- ✅ **Preserve evidence for root cause analysis**
- ✅ **Update safety procedures based on incidents**

## When to Seek Help

Consider getting additional review when:

- **Complex multi-table restructuring** required
- **Large data migrations** (>1M rows affected)
- **Critical business logic changes** in database
- **Performance-sensitive changes** on high-traffic tables
- **Regulatory/compliance considerations** apply

## Tools & Resources

### Backup Locations
- Database backups: `backups/database/`
- Rollback scripts: `backups/rollback-scripts/`
- Migration diffs: `backups/migrations/`

### Useful Commands
```bash
# Generate safe migration
./generate-migration.sh "description"

# Deploy with safety checks
./deploy-to-production.sh

# Emergency rollback
./rollback-production.sh

# View recent backups
ls -la backups/database/
```

### External Resources
- [PostgreSQL ALTER TABLE docs](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)

---

## Summary

Your deployment system provides **multiple layers of protection**:

1. **Automatic detection** of dangerous operations
2. **Safety transforms** applied by default  
3. **Manual review options** for complex changes
4. **Comprehensive backup** before every change
5. **One-command rollback** for emergencies

**Key Philosophy**: When in doubt, choose the safer option. It's better to take extra time for a complex migration than to risk data loss or service disruption.

🛡️ **Your data and users are protected by design.**