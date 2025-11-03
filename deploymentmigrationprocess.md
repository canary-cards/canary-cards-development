# Canary Cards — Deploy Guide (DB + Code)

This single guide walks a non-technical teammate from zero to running either deployment script:

* **sync\_staging\_to\_prod.sh** – safe, schema-only sync (keeps prod data)
* **mirror\_staging\_to\_prod.sh** – wipe-and-replace (destroys prod `public` data)

Repo: **main** branch of
[https://github.com/canary-cards/canary-cards-development](https://github.com/canary-cards/canary-cards-development)

---

## 0) First-time setup (fresh machine)

```bash
# Create a workspace and clone the repo
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/canary-cards/canary-cards-development.git
cd canary-cards-development
git checkout main
```

**Install tools (one time):**
* Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

* Install Docker Desktop
brew install --cask docker

* Docker Desktop (start it)
* PostgreSQL client (psql/pg\_dump): `brew install postgresql`
* Supabase CLI: `brew install supabase/tap/supabase`
* Git (if missing): `xcode-select --install` or `brew install git`

> Tip: After installing Docker Desktop, open it so the daemon is running before you deploy.

---

## 1) Environment variables (copy‑paste)

The scripts will **prompt** if these are missing, but the fastest path is to set them once per terminal session (the 3 you need are stored in our pw manager with the relevant names)

### Option A — Create a local env file (recommended)

```bash
cat > .env.canary <<'EOF'
export STAGING_DB_PASSWORD='REPLACE_ME_STAGING_PG_PASSWORD'
export PRODUCTION_DB_PASSWORD='REPLACE_ME_PROD_PG_PASSWORD'
export SUPABASE_STAGING_REF='pugnjgvdisdbdkbofwrc'
export SUPABASE_PROD_REF='xwsgyxlvxntgpochonwe'
# Optional: needed to deploy Edge Functions
# export SUPABASE_ACCESS_TOKEN='sbp_REPLACE_ME'
EOF

# load it for this terminal session
source .env.canary
```

### Option B — One‑liner “echo” (sets vars in this shell only)

```bash
echo "export STAGING_DB_PASSWORD='REPLACE_ME_STAGING_PG_PASSWORD';
export PRODUCTION_DB_PASSWORD='REPLACE_ME_PROD_PG_PASSWORD';
export SUPABASE_STAGING_REF='pugnjgvdisdbdkbofwrc';
export SUPABASE_PROD_REF='xwsgyxlvxntgpochonwe';
# export SUPABASE_ACCESS_TOKEN='sbp_REPLACE_ME'  # optional
" > /tmp/canary_env && source /tmp/canary_env
```

**What these are:**

* `STAGING_DB_PASSWORD`, `PRODUCTION_DB_PASSWORD`: the DB passwords for your Supabase projects.
* `SUPABASE_STAGING_REF`, `SUPABASE_PROD_REF`: your Supabase project refs, found also in the URLs
* `SUPABASE_ACCESS_TOKEN` (optional): required if you want the script to deploy Edge Functions.

---

## 2) Choosing the right script

* **Sync (safe default)** → `./sync_staging_to_prod.sh` (almost always use this)

  * Updates **schema only** (public schema), **preserves prod data**.
  * Perfect for everyday deploys (new tables/columns/indexes, enum additions, functions/triggers/RLS).

* **Mirror (destructive)** → `./mirror_staging_to_prod.sh`

  * **Drops prod `public` schema and data**, recreates from staging’s schema.
  * Use only when you **want a clean slate**.

> Both scripts **ignore the `storage` schema** (Supabase-managed ownership/privileges).

---

## 3) Git workflow (use this before every run / re-run)

```bash
git fetch origin
git reset --hard origin/main

# keep local main in sync with GitHub
git pull origin main

# ensure the sync script is executable and committed
chmod +x sync_staging_to_prod.sh
git add sync_staging_to_prod.sh && git commit -m "chore: make sync script executable" || true
```

**Why this matters:**

* `fetch + reset --hard origin/main` guarantees your local `main` exactly matches GitHub.
* `chmod +x` makes the script runnable; the tiny commit keeps your working tree clean so the deploy step can merge **main → realproduction** without blocking.
* If you edited either script locally and don’t want to keep those edits, run `git reset --hard origin/main` to discard them.

**Manual code deploy (if you ever need to do it yourself):**

```bash
# Make sure 'main' is up to date
git fetch origin && git reset --hard origin/main

# Prepare prod branch locally
git checkout realproduction || git checkout -b realproduction origin/realproduction
git fetch origin && git reset --hard origin/realproduction

# Merge and push
git merge main --no-edit
git push origin realproduction
```

---

## 4) Running the **Sync** script (interactive)

```bash
./sync_staging_to_prod.sh
```

**What happens:**

1. Checks tools (docker, psql, pg\_dump, supabase, git). If one’s missing, it prints how to install.
2. Prompts you for any missing env vars (passwords hidden).
3. Shows a short menu:

   * **Dry run** (preview SQL only)
   * **Apply additive** changes (safe default)
   * Allow **destructive** changes (drops/renames) — only if you really intend to remove things
   * Git handling for local edits: **Autostash** (recommended) / **Discard local** / **Abort if dirty**
4. Verifies DB connectivity (Supabase pooler).
5. Makes a **full prod backup** at `backups/<timestamp>_sync/prod_full.sql`.
6. Generates a schema **diff** (staging → prod) with Docker + `migra` and **sanitizes** noisy statements.
7. Applies the diff **in a transaction** with conservative timeouts (data preserved).
8. **Deploys code** by merging `main → realproduction` and pushing.
9. **Deploys Edge Functions** (if `SUPABASE_ACCESS_TOKEN` is present).

**Flags (for CI or power users):**

```bash
# Preview only
./sync_staging_to_prod.sh --dry-run

# Apply additive changes, auto-stash local edits
./sync_staging_to_prod.sh --autostash

# Allow drops/renames (contract phase), auto-stash local edits
./sync_staging_to_prod.sh --allow-destructive --autostash

# Verbose logs
./sync_staging_to_prod.sh --debug
```

**Limitations:**

* Only the `public` schema is synced.
* Enum values are **added** automatically; removing/renaming enum values is **destructive**.
* No `storage` schema management.

---

## 5) Running the **Mirror** script (wipe‑and‑replace)

> ⚠️ **This destroys prod `public` data.** Use only when you want a clean slate.

```bash
chmod +x mirror_staging_to_prod.sh
./mirror_staging_to_prod.sh
```

**What it does:**

* Full prod backup (path printed in the console)
* `DROP SCHEMA public CASCADE;` then **recreate** and apply staging **schema**
* (Your version may optionally copy `storage.buckets` rows; it still **skips storage policies/grants**)

**Prefer `sync` for day‑to‑day work** so you don’t lose data.

---

## 6) Troubleshooting (fast)

* **Docker error** (not running or volume path issue): open Docker Desktop; re-run.
* **Missing CLI**: install as prompted.
* **“Uncommitted changes in working tree”** when deploying code:

  * Choose **Autostash** (recommended) or **Discard local** in the sync script.
  * Or manually:

    ```bash
    git stash push -u -m sync_autostash_$(date +%Y%m%d_%H%M%S)
    # or, to throw away
    git reset --hard && git clean -fd
    ```
* **Permission errors on `storage`**: expected—`storage` is Supabase-managed and intentionally ignored by these tools.

---

## 7) Everything in one quick block (copy‑paste)

```bash
# From a clean shell:
cd ~/projects || mkdir -p ~/projects && cd ~/projects
[ -d canary-cards-development ] || git clone https://github.com/canary-cards/canary-cards-development.git
cd canary-cards-development
git fetch origin && git reset --hard origin/main

# Set env (edit the values!)
cat > .env.canary <<'EOF'
export STAGING_DB_PASSWORD='REPLACE_ME_STAGING_PG_PASSWORD'
export PRODUCTION_DB_PASSWORD='REPLACE_ME_PROD_PG_PASSWORD'
export SUPABASE_STAGING_REF='pugnjgvdisdbdkbofwrc'
export SUPABASE_PROD_REF='xwsgyxlvxntgpochonwe'
# export SUPABASE_ACCESS_TOKEN='sbp_REPLACE_ME'  # optional
EOF
source .env.canary

# Make sure scripts are executable and committed once
chmod +x sync_staging_to_prod.sh
git add sync_staging_to_prod.sh && git commit -m "chore: make sync script executable" || true

# Run interactive sync (recommended)
./sync_staging_to_prod.sh
```

---

### TL;DR

* Use **sync** for normal deploys (keeps data).
* Use **mirror** only when you mean to **destroy prod `public` data**.
* Always `git fetch` + `git reset --hard origin/main` before running.
* Have your env vars ready (the script will prompt if not).
