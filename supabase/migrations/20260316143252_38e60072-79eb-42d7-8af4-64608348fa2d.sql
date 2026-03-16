
ALTER TABLE public.predefined_reports ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Backfill existing reports with the canonical order
UPDATE public.predefined_reports SET display_order = 0 WHERE name = 'PIM General';
UPDATE public.predefined_reports SET display_order = 1 WHERE name = 'Portafolio foco';
UPDATE public.predefined_reports SET display_order = 2 WHERE name = 'SumaGO B2B';
UPDATE public.predefined_reports SET display_order = 3 WHERE name = 'SumaGO B2C';
UPDATE public.predefined_reports SET display_order = 4 WHERE name = 'Operaciones';

-- Any other reports get order 99
UPDATE public.predefined_reports SET display_order = 99 WHERE name NOT IN ('PIM General', 'Portafolio foco', 'SumaGO B2B', 'SumaGO B2C', 'Operaciones') AND display_order = 0;
