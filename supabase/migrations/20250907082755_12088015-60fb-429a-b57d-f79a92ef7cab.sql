
-- 1) Ensure generation_status enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation_status') THEN
    CREATE TYPE generation_status AS ENUM ('pending','success','error','approved');
  END IF;
END$$;

-- 2) Rename tables if needed
DO $$
BEGIN
  IF to_regclass('public.postcard_drafts') IS NULL AND to_regclass('public.ai_drafts') IS NOT NULL THEN
    ALTER TABLE public.ai_drafts RENAME TO postcard_drafts;
  END IF;
END$$;

DO $$
BEGIN
  IF to_regclass('public.postcard_draft_sources') IS NULL AND to_regclass('public.ai_draft_sources') IS NOT NULL THEN
    ALTER TABLE public.ai_draft_sources RENAME TO postcard_draft_sources;
  END IF;
END$$;

-- 3) Create tables if they don't exist (fresh setups)
CREATE TABLE IF NOT EXISTS public.postcard_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ai_drafted_message text NULL,
  human_approved_message text NULL,
  recipient_type recipient_type NOT NULL,
  sources_count smallint NOT NULL DEFAULT 0,
  recipient_snapshot jsonb NOT NULL,
  sent_order_id uuid NULL,
  invite_code text NULL,
  zip_code text NOT NULL,
  concerns text NULL,
  personal_impact text NULL,
  generation_status generation_status NOT NULL DEFAULT 'pending',
  api_status_code integer NULL,
  api_status_message text NULL
);

CREATE TABLE IF NOT EXISTS public.postcard_draft_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_draft_id uuid NOT NULL,
  ordinal smallint NOT NULL,
  data_point_count integer NOT NULL DEFAULT 0,
  url text NOT NULL,
  description text NOT NULL
);

-- 4) Adjust columns on renamed/created postcard_drafts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='postcard_drafts'
      AND column_name='ai_drafted_message' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.postcard_drafts
      ALTER COLUMN ai_drafted_message DROP NOT NULL;
  END IF;
END$$;

ALTER TABLE public.postcard_drafts
  ADD COLUMN IF NOT EXISTS generation_status generation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS api_status_code integer,
  ADD COLUMN IF NOT EXISTS api_status_message text;

-- 5) RLS (deny-by-default so only service role edges can access)
ALTER TABLE public.postcard_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcard_draft_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='postcard_drafts' AND policyname='postcard_drafts_deny_public_access'
  ) THEN
    CREATE POLICY "postcard_drafts_deny_public_access"
      ON public.postcard_drafts
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='postcard_draft_sources' AND policyname='postcard_draft_sources_deny_public_access'
  ) THEN
    CREATE POLICY "postcard_draft_sources_deny_public_access"
      ON public.postcard_draft_sources
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END$$;
