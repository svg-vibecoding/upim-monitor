
-- Table to store attribute column order from Excel uploads
CREATE TABLE public.pim_metadata (
  id text PRIMARY KEY DEFAULT 'singleton',
  attribute_order text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pim_metadata ENABLE ROW LEVEL SECURITY;

-- Everyone can read metadata
CREATE POLICY "Anon can read pim_metadata" ON public.pim_metadata FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can read pim_metadata" ON public.pim_metadata FOR SELECT TO authenticated USING (true);

-- Temp anon UPDATE on predefined_reports (TO REMOVE when auth is real)
CREATE POLICY "Temp anon update predefined_reports" ON public.predefined_reports FOR UPDATE TO anon USING (true) WITH CHECK (true);
