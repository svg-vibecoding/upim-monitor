
-- Table: pim_upload_history
CREATE TABLE public.pim_upload_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  total_rows integer NOT NULL DEFAULT 0,
  unique_rows integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.pim_upload_history ENABLE ROW LEVEL SECURITY;

-- Temp anon read (transitional, remove when auth is real)
CREATE POLICY "Temp anon read pim_upload_history"
  ON public.pim_upload_history FOR SELECT TO anon USING (true);

-- Authenticated read
CREATE POLICY "Authenticated can read pim_upload_history"
  ON public.pim_upload_history FOR SELECT TO authenticated USING (true);

-- Temp anon insert (transitional)
CREATE POLICY "Temp anon insert pim_upload_history"
  ON public.pim_upload_history FOR INSERT TO anon WITH CHECK (true);

-- Authenticated insert
CREATE POLICY "Authenticated can insert pim_upload_history"
  ON public.pim_upload_history FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: deactivate previous records when a new one is inserted
CREATE OR REPLACE FUNCTION public.set_single_active_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE pim_upload_history SET is_active = false WHERE id <> NEW.id AND is_active = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_active_upload
  AFTER INSERT ON public.pim_upload_history
  FOR EACH ROW EXECUTE FUNCTION public.set_single_active_upload();
