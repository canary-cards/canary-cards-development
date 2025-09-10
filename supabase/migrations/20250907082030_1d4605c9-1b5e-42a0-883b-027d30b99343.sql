
-- 1) Create enum for postcard draft generation lifecycle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'draft_generation_status') THEN
    CREATE TYPE public.draft_generation_status AS ENUM ('pending', 'success', 'error', 'approved');
  END IF;
END$$;

-- 2) Rename ai_* tables to postcard_* tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_drafts' AND table_schema = 'public') THEN
        ALTER TABLE public.ai_drafts RENAME TO postcard_drafts;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_draft_sources' AND table_schema = 'public') THEN
        ALTER TABLE public.ai_draft_sources RENAME TO postcard_draft_sources;
    END IF;
END $$;

-- 3) Relax drafted message and add observability/lifecycle fields
-- Only modify table if it exists (it might be renamed or not exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'postcard_drafts' AND table_schema = 'public') THEN
        -- Check if ai_drafted_message column exists before trying to modify it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'postcard_drafts' AND column_name = 'ai_drafted_message') THEN
            ALTER TABLE public.postcard_drafts ALTER COLUMN ai_drafted_message DROP NOT NULL;
        END IF;
        
        ALTER TABLE public.postcard_drafts
          ADD COLUMN IF NOT EXISTS generation_status public.draft_generation_status NOT NULL DEFAULT 'pending',
          ADD COLUMN IF NOT EXISTS api_status_code integer,
          ADD COLUMN IF NOT EXISTS api_status_message text;
    END IF;
END $$;

-- 4) Create updated trigger functions for sources_count and max sources
CREATE OR REPLACE FUNCTION public.update_postcard_draft_sources_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.postcard_drafts 
      SET sources_count = sources_count + 1 
      WHERE id = NEW.ai_draft_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.postcard_drafts 
      SET sources_count = sources_count - 1 
      WHERE id = OLD.ai_draft_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_max_sources_per_postcard_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM public.postcard_draft_sources WHERE ai_draft_id = NEW.ai_draft_id) > 4 THEN
    RAISE EXCEPTION 'Maximum of 4 sources allowed per postcard draft';
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) Drop old triggers if they existed on old table names (harmless if they didn't)
-- Only attempt to drop triggers if the old tables still exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_draft_sources' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS tgr_ai_draft_sources_count ON public.ai_draft_sources;
        DROP TRIGGER IF EXISTS tgr_enforce_max_sources_per_draft ON public.ai_draft_sources;
    END IF;
END $$;

-- 6) Create new triggers on postcard_draft_sources (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'postcard_draft_sources' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS tgr_postcard_draft_sources_count ON public.postcard_draft_sources;
        CREATE TRIGGER tgr_postcard_draft_sources_count
        AFTER INSERT OR DELETE ON public.postcard_draft_sources
        FOR EACH ROW EXECUTE FUNCTION public.update_postcard_draft_sources_count();
        
        DROP TRIGGER IF EXISTS tgr_enforce_max_sources_per_postcard_draft ON public.postcard_draft_sources;
        CREATE TRIGGER tgr_enforce_max_sources_per_postcard_draft
        BEFORE INSERT ON public.postcard_draft_sources
        FOR EACH ROW EXECUTE FUNCTION public.enforce_max_sources_per_postcard_draft();
    END IF;
END $$;

-- 7) Helpful indexes for querying/debugging (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'postcard_drafts' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_postcard_drafts_created_at ON public.postcard_drafts (created_at);
        CREATE INDEX IF NOT EXISTS idx_postcard_drafts_generation_status ON public.postcard_drafts (generation_status);
        -- Only create zip_code index if the column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'postcard_drafts' AND column_name = 'zip_code') THEN
            CREATE INDEX IF NOT EXISTS idx_postcard_drafts_zip_code ON public.postcard_drafts (zip_code);
        END IF;
    END IF;
END $$;
