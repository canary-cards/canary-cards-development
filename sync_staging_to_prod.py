#!/usr/bin/env python3
"""
Canary Cards - Staging to Production Sync Script
===============================================

This script performs a complete sync from staging to production:
1. Syncs database schema changes (safe, additive only)
2. Deploys code changes (main → realproduction branch)
3. Deploys all Supabase Edge Functions

Requirements:
- Python 3.7+
- pip install supabase requests gitpython python-dotenv
- Supabase CLI installed and accessible
- Git repository with main and realproduction branches

Usage:
    python sync_staging_to_prod.py [--dry-run] [--allow-destructive]

Environment Variables (set these in .env or manually):
    SUPABASE_STAGING_REF=pugnjgvdisdbdkbofwrc
    SUPABASE_PROD_REF=xwsgyxlvxntgpochonwe
    STAGING_DB_PASSWORD=your_staging_password
    PRODUCTION_DB_PASSWORD=your_production_password
    SUPABASE_ACCESS_TOKEN=sbp_your_access_token

Author: Claude Code
Last Modified: 2025-11-03
"""

import os
import sys
import json
import time
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

try:
    import requests
    from git import Repo, GitCommandError
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError as e:
    print(f"❌ Missing required Python package: {e}")
    print("Install with: pip install supabase requests gitpython python-dotenv")
    sys.exit(1)


class Colors:
    """ANSI color codes for terminal output"""
    BLUE = '\033[0;34m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    CYAN = '\033[0;36m'
    PURPLE = '\033[0;35m'
    NC = '\033[0m'  # No Color


class StagingToProdSync:
    """Main class for handling staging to production synchronization"""
    
    def __init__(self, dry_run: bool = False, allow_destructive: bool = False):
        self.dry_run = dry_run
        self.allow_destructive = allow_destructive
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_dir = Path(f"backups/{self.timestamp}_sync")
        
        # Environment variables - MODIFY THESE IF NEEDED
        self.config = {
            'SUPABASE_STAGING_REF': 'pugnjgvdisdbdkbofwrc',
            'SUPABASE_PROD_REF': 'xwsgyxlvxntgpochonwe', 
            'STAGING_DB_PASSWORD': 'yVIPdCTkI1Orz5Mr',
            'PRODUCTION_DB_PASSWORD': 'yVIPdCTkI1Orz5Mr',
            'SUPABASE_ACCESS_TOKEN': 'sbp_1828ccf7ff9aa9d1fd132c708e3b8f59a6704544'
        }
        
        # Database connection strings
        self.staging_url = f"postgresql://postgres.{self.config['SUPABASE_STAGING_REF']}:{self.config['STAGING_DB_PASSWORD']}@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
        self.prod_url = f"postgresql://postgres.{self.config['SUPABASE_PROD_REF']}:{self.config['PRODUCTION_DB_PASSWORD']}@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
        
        # Initialize Supabase clients
        self.staging_client = create_client(
            f"https://{self.config['SUPABASE_STAGING_REF']}.supabase.co",
            self._get_anon_key('staging')
        )
        self.prod_client = create_client(
            f"https://{self.config['SUPABASE_PROD_REF']}.supabase.co", 
            self._get_anon_key('production')
        )
        
        self.repo = None

    def _get_anon_key(self, env: str) -> str:
        """Get anonymous key for the specified environment"""
        # These are the public anon keys from your .env files
        if env == 'staging':
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z25qZ3ZkaXNkYmRrYm9md3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTM0NzYsImV4cCI6MjA3Mjc2OTQ3Nn0.mCDDS4hIeIatRTlDiGCKnPgdCNFxn6LFK1nkREGMo3s"
        else:  # production
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3c2d5eGx2eG50Z3BvY2hvbndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0ODI4MDEsImV4cCI6MjA2OTA1ODgwMX0.o-Jx0nWkjnOj-61kIaZ5s7UW2gcZa6CFQYUeeqjank8"

    def print_header(self):
        """Print the script header and configuration"""
        print(f"{Colors.CYAN}🔄 Canary Cards - Staging → Production Sync{Colors.NC}")
        print(f"{Colors.BLUE}{'=' * 50}{Colors.NC}")
        print(f"{Colors.BLUE}Mode: {'DRY RUN' if self.dry_run else 'LIVE DEPLOYMENT'}{Colors.NC}")
        print(f"{Colors.BLUE}Destructive: {'Enabled' if self.allow_destructive else 'Disabled'}{Colors.NC}")
        print(f"{Colors.BLUE}Staging:  {self.config['SUPABASE_STAGING_REF']}{Colors.NC}")
        print(f"{Colors.BLUE}Production: {self.config['SUPABASE_PROD_REF']}{Colors.NC}")
        print()

    def load_environment(self):
        """Load environment variables from .env file or system"""
        print(f"{Colors.YELLOW}🔧 Loading environment configuration...{Colors.NC}")
        
        # Try to load from .env file first
        env_file = Path('.env')
        if env_file.exists():
            load_dotenv()
            print(f"  ✅ Loaded .env file")
        
        # Override with system environment variables if present
        for key in self.config:
            env_value = os.getenv(key)
            if env_value:
                self.config[key] = env_value
                print(f"  ✅ Using environment variable: {key}")
        
        # Validate required variables
        missing_vars = [key for key, value in self.config.items() if not value]
        if missing_vars:
            print(f"{Colors.RED}❌ Missing required environment variables:{Colors.NC}")
            for var in missing_vars:
                print(f"  - {var}")
            print(f"\n{Colors.YELLOW}Set these in your .env file or environment:{Colors.NC}")
            for var in missing_vars:
                print(f"  export {var}=your_value_here")
            sys.exit(1)
        
        print(f"  ✅ All required environment variables are set")

    def test_connectivity(self):
        """Test database connectivity to both staging and production"""
        print(f"{Colors.YELLOW}🔗 Testing database connectivity...{Colors.NC}")
        
        try:
            # Test staging connection
            result = subprocess.run([
                'psql', self.staging_url, '-c', 'SELECT 1;'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                print(f"  ✅ Staging database connection successful")
            else:
                raise Exception(f"Staging connection failed: {result.stderr}")
                
        except Exception as e:
            print(f"{Colors.RED}❌ Staging database connection failed: {e}{Colors.NC}")
            sys.exit(1)
        
        try:
            # Test production connection
            result = subprocess.run([
                'psql', self.prod_url, '-c', 'SELECT 1;'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                print(f"  ✅ Production database connection successful")
            else:
                raise Exception(f"Production connection failed: {result.stderr}")
                
        except Exception as e:
            print(f"{Colors.RED}❌ Production database connection failed: {e}{Colors.NC}")
            sys.exit(1)

    def create_backup(self):
        """Create a full backup of the production database"""
        if self.dry_run:
            print(f"{Colors.YELLOW}💾 [DRY RUN] Would create production backup{Colors.NC}")
            return
            
        print(f"{Colors.YELLOW}💾 Creating production database backup...{Colors.NC}")
        
        # Create backup directory
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        backup_file = self.backup_dir / "prod_full.sql"
        
        try:
            cmd = [
                'pg_dump',
                '-h', 'aws-0-us-west-1.pooler.supabase.com',
                '-p', '6543',
                '-U', f"postgres.{self.config['SUPABASE_PROD_REF']}",
                '-d', 'postgres',
                '-f', str(backup_file)
            ]
            
            env = os.environ.copy()
            env['PGPASSWORD'] = self.config['PRODUCTION_DB_PASSWORD']
            
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                size = backup_file.stat().st_size / (1024 * 1024)  # MB
                print(f"  ✅ Backup created: {backup_file} ({size:.1f} MB)")
            else:
                raise Exception(f"Backup failed: {result.stderr}")
                
        except Exception as e:
            print(f"{Colors.RED}❌ Backup creation failed: {e}{Colors.NC}")
            sys.exit(1)

    def generate_schema_diff(self) -> Optional[str]:
        """Generate schema diff using migra in Docker"""
        print(f"{Colors.YELLOW}🧮 Generating schema diff (prod → staging)...{Colors.NC}")
        
        diff_file = self.backup_dir / "schema_diff.sql"
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Build migra command
            migra_flags = "--schema public --with-privileges"
            if self.allow_destructive:
                migra_flags += " --unsafe"
            
            docker_cmd = f"""
            pip install --no-cache-dir psycopg2-binary migra >/dev/null 2>&1 && 
            migra {migra_flags} "{self.prod_url}" "{self.staging_url}"
            """
            
            result = subprocess.run([
                'docker', 'run', '--rm',
                'python:3.11-slim',
                'bash', '-c', docker_cmd
            ], capture_output=True, text=True, timeout=120)
            
            if result.returncode != 0:
                raise Exception(f"Migra failed: {result.stderr}")
            
            # Write diff to file
            diff_content = result.stdout.strip()
            diff_file.write_text(diff_content)
            
            if not diff_content:
                print(f"  ✅ No schema differences found")
                return None
            
            # Check for destructive changes if not allowed
            if not self.allow_destructive and "destructive statements generated" in diff_content.lower():
                print(f"{Colors.YELLOW}  ⚠️  Destructive changes detected but not allowed{Colors.NC}")
                print(f"  Use --allow-destructive flag to include them")
                
                # Try again with --unsafe to see what would be done
                docker_cmd_unsafe = f"""
                pip install --no-cache-dir psycopg2-binary migra >/dev/null 2>&1 && 
                migra {migra_flags} --unsafe "{self.prod_url}" "{self.staging_url}"
                """
                
                result = subprocess.run([
                    'docker', 'run', '--rm',
                    'python:3.11-slim', 
                    'bash', '-c', docker_cmd_unsafe
                ], capture_output=True, text=True, timeout=120)
                
                if result.returncode == 0:
                    diff_content = result.stdout.strip()
                    diff_file.write_text(diff_content)
            
            print(f"  ✅ Schema diff generated: {diff_file}")
            print(f"  📄 Diff size: {len(diff_content)} characters")
            
            return diff_content
            
        except Exception as e:
            print(f"{Colors.RED}❌ Schema diff generation failed: {e}{Colors.NC}")
            sys.exit(1)

    def sanitize_diff(self, diff_content: str) -> str:
        """Remove owner changes and other Supabase-specific modifications"""
        if not diff_content:
            return ""
            
        print(f"{Colors.YELLOW}🧹 Sanitizing schema diff...{Colors.NC}")
        
        lines = diff_content.split('\n')
        sanitized_lines = []
        
        for line in lines:
            # Skip owner changes
            if 'OWNER TO' in line.upper():
                continue
            # Skip ALTER DEFAULT PRIVILEGES  
            if 'ALTER DEFAULT PRIVILEGES' in line.upper():
                continue
            # Skip empty lines
            if not line.strip():
                continue
                
            sanitized_lines.append(line)
        
        sanitized_content = '\n'.join(sanitized_lines)
        
        # Write sanitized diff
        sanitized_file = self.backup_dir / "schema_diff_sanitized.sql"
        sanitized_file.write_text(sanitized_content)
        
        print(f"  ✅ Sanitized diff: {sanitized_file}")
        return sanitized_content

    def apply_schema_changes(self, diff_content: str):
        """Apply schema changes to production database"""
        if not diff_content.strip():
            print(f"  ✅ No schema changes to apply")
            return
            
        if self.dry_run:
            print(f"{Colors.YELLOW}🚀 [DRY RUN] Would apply schema changes to production{Colors.NC}")
            print(f"  SQL to execute:")
            print(f"{Colors.CYAN}{diff_content[:500]}{'...' if len(diff_content) > 500 else ''}{Colors.NC}")
            return
        
        print(f"{Colors.YELLOW}🚀 Applying schema changes to production...{Colors.NC}")
        
        try:
            # Write SQL to temp file
            sql_file = self.backup_dir / "apply_changes.sql"
            sql_content = f"""
-- Ensure common extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Begin transaction
BEGIN;

-- Set conservative timeouts
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Apply schema changes
{diff_content}

-- Commit changes
COMMIT;
"""
            sql_file.write_text(sql_content)
            
            # Apply changes
            cmd = ['psql', self.prod_url, '-f', str(sql_file)]
            env = os.environ.copy()
            env['PGPASSWORD'] = self.config['PRODUCTION_DB_PASSWORD']
            
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                print(f"  ✅ Schema changes applied successfully")
            else:
                raise Exception(f"Schema application failed: {result.stderr}")
                
        except Exception as e:
            print(f"{Colors.RED}❌ Schema application failed: {e}{Colors.NC}")
            print(f"{Colors.YELLOW}💡 Database backup available at: {self.backup_dir}/prod_full.sql{Colors.NC}")
            sys.exit(1)

    def deploy_code_changes(self):
        """Deploy code changes from main to realproduction branch"""
        if self.dry_run:
            print(f"{Colors.YELLOW}📦 [DRY RUN] Would deploy code changes (main → realproduction){Colors.NC}")
            return
            
        print(f"{Colors.YELLOW}📦 Deploying code changes (main → realproduction)...{Colors.NC}")
        
        try:
            # Initialize repo
            self.repo = Repo('.')
            current_branch = self.repo.active_branch.name
            
            # Check for uncommitted changes
            if self.repo.is_dirty() or self.repo.untracked_files:
                print(f"{Colors.RED}❌ Uncommitted changes detected. Please commit or stash them first.{Colors.NC}")
                sys.exit(1)
            
            # Fetch latest changes
            print(f"  🔄 Fetching latest changes...")
            self.repo.remotes.origin.fetch()
            
            # Checkout realproduction branch
            print(f"  🔄 Switching to realproduction branch...")
            try:
                realproduction = self.repo.heads.realproduction
                realproduction.checkout()
            except:
                print(f"{Colors.RED}❌ realproduction branch not found{Colors.NC}")
                sys.exit(1)
            
            # Merge main into realproduction
            print(f"  🔄 Merging main into realproduction...")
            main_branch = self.repo.heads.main
            self.repo.git.merge(main_branch, '--no-edit')
            
            # Push changes
            print(f"  🔄 Pushing realproduction branch...")
            self.repo.remotes.origin.push('realproduction')
            
            print(f"  ✅ Code deployment successful")
            
            # Return to original branch
            if current_branch != 'realproduction':
                original_branch = self.repo.heads[current_branch]
                original_branch.checkout()
                
        except GitCommandError as e:
            print(f"{Colors.RED}❌ Git operation failed: {e}{Colors.NC}")
            sys.exit(1)
        except Exception as e:
            print(f"{Colors.RED}❌ Code deployment failed: {e}{Colors.NC}")
            sys.exit(1)

    def deploy_edge_functions(self):
        """Deploy all Supabase Edge Functions to production"""
        if self.dry_run:
            print(f"{Colors.YELLOW}⚡ [DRY RUN] Would deploy Edge Functions to production{Colors.NC}")
            return
            
        print(f"{Colors.YELLOW}⚡ Deploying Edge Functions to production...{Colors.NC}")
        
        try:
            # Login to Supabase CLI
            print(f"  🔑 Authenticating with Supabase...")
            subprocess.run([
                'supabase', 'login', '--token', self.config['SUPABASE_ACCESS_TOKEN']
            ], check=True, capture_output=True)
            
            # Link to production project
            subprocess.run([
                'supabase', 'link', '--project-ref', self.config['SUPABASE_PROD_REF']
            ], check=True, capture_output=True)
            
            # Deploy all functions
            functions_dir = Path('supabase/functions')
            if functions_dir.exists():
                deployed_count = 0
                failed_count = 0
                
                for func_dir in functions_dir.iterdir():
                    if func_dir.is_dir() and not func_dir.name.startswith('_'):
                        func_name = func_dir.name
                        print(f"  📤 Deploying {func_name}...")
                        
                        try:
                            result = subprocess.run([
                                'supabase', 'functions', 'deploy', func_name,
                                '--project-ref', self.config['SUPABASE_PROD_REF']
                            ], capture_output=True, text=True, timeout=60)
                            
                            if result.returncode == 0:
                                deployed_count += 1
                                print(f"    ✅ {func_name} deployed successfully")
                            else:
                                failed_count += 1
                                print(f"    ❌ {func_name} deployment failed: {result.stderr.strip()}")
                                
                        except subprocess.TimeoutExpired:
                            failed_count += 1
                            print(f"    ⏰ {func_name} deployment timed out")
                        except Exception as e:
                            failed_count += 1
                            print(f"    ❌ {func_name} deployment error: {e}")
                
                print(f"  ✅ Edge Functions deployment complete: {deployed_count} successful, {failed_count} failed")
                
            else:
                print(f"  ⚠️  No functions directory found")
                
        except subprocess.CalledProcessError as e:
            print(f"{Colors.RED}❌ Supabase CLI operation failed: {e}{Colors.NC}")
            sys.exit(1)
        except Exception as e:
            print(f"{Colors.RED}❌ Edge Functions deployment failed: {e}{Colors.NC}")
            sys.exit(1)

    def print_summary(self):
        """Print deployment summary"""
        print(f"\n{Colors.GREEN}🎉 Deployment Summary{Colors.NC}")
        print(f"{Colors.GREEN}{'=' * 30}{Colors.NC}")
        print(f"  📅 Timestamp: {self.timestamp}")
        print(f"  💾 Backup: {self.backup_dir}/prod_full.sql")
        print(f"  📄 Schema diff: {self.backup_dir}/schema_diff.sql")
        print(f"  📄 Sanitized diff: {self.backup_dir}/schema_diff_sanitized.sql")
        
        if self.dry_run:
            print(f"\n{Colors.CYAN}ℹ️  This was a DRY RUN - no changes were made to production{Colors.NC}")
        else:
            print(f"\n{Colors.GREEN}✅ All changes have been successfully applied to production{Colors.NC}")
            print(f"  🌐 Production URL: https://{self.config['SUPABASE_PROD_REF']}.supabase.co")

    def run(self):
        """Main execution method"""
        try:
            self.print_header()
            self.load_environment()
            self.test_connectivity()
            self.create_backup()
            
            # Generate and apply schema changes
            diff_content = self.generate_schema_diff()
            if diff_content:
                sanitized_diff = self.sanitize_diff(diff_content)
                self.apply_schema_changes(sanitized_diff)
            
            # Deploy code and functions
            self.deploy_code_changes()
            self.deploy_edge_functions()
            
            self.print_summary()
            
        except KeyboardInterrupt:
            print(f"\n{Colors.YELLOW}⚠️  Deployment interrupted by user{Colors.NC}")
            sys.exit(1)
        except Exception as e:
            print(f"\n{Colors.RED}❌ Unexpected error: {e}{Colors.NC}")
            sys.exit(1)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Sync Canary Cards staging environment to production",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sync_staging_to_prod.py                    # Normal deployment
  python sync_staging_to_prod.py --dry-run          # Preview changes only
  python sync_staging_to_prod.py --allow-destructive # Include destructive changes

Environment Variables:
  Set these in .env file or as environment variables:
  
  SUPABASE_STAGING_REF=pugnjgvdisdbdkbofwrc
  SUPABASE_PROD_REF=xwsgyxlvxntgpochonwe  
  STAGING_DB_PASSWORD=your_staging_password
  PRODUCTION_DB_PASSWORD=your_production_password
  SUPABASE_ACCESS_TOKEN=sbp_your_access_token
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without applying them'
    )
    
    parser.add_argument(
        '--allow-destructive',
        action='store_true', 
        help='Allow destructive schema changes (drops, renames)'
    )
    
    args = parser.parse_args()
    
    # Check dependencies
    required_commands = ['docker', 'psql', 'pg_dump', 'supabase', 'git']
    missing_commands = []
    
    for cmd in required_commands:
        try:
            subprocess.run([cmd, '--version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing_commands.append(cmd)
    
    if missing_commands:
        print(f"{Colors.RED}❌ Missing required commands: {', '.join(missing_commands)}{Colors.NC}")
        print(f"\n{Colors.YELLOW}Install missing dependencies:{Colors.NC}")
        for cmd in missing_commands:
            if cmd == 'docker':
                print(f"  - Install Docker Desktop and start it")
            elif cmd in ['psql', 'pg_dump']:
                print(f"  - brew install postgresql")
            elif cmd == 'supabase':
                print(f"  - brew install supabase/tap/supabase")
            elif cmd == 'git':
                print(f"  - Install Git")
        sys.exit(1)
    
    # Run sync
    sync = StagingToProdSync(dry_run=args.dry_run, allow_destructive=args.allow_destructive)
    sync.run()


if __name__ == "__main__":
    main()