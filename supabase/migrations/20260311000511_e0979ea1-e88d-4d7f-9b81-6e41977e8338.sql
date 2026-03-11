-- Temporary anon SELECT policies for transitional read access (no auth yet)
-- These must be removed when real authentication is implemented

CREATE POLICY "Temp anon read pim_records"
  ON public.pim_records FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Temp anon read predefined_reports"
  ON public.predefined_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Temp anon read dimensions"
  ON public.dimensions FOR SELECT
  TO anon
  USING (true);