
ALTER TABLE public.pim_upload_history 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attribute_order text[] NOT NULL DEFAULT '{}'::text[];
