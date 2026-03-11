
-- 1. Update get_pim_kpis to calculate digital_base from JSONB
CREATE OR REPLACE FUNCTION public.get_pim_kpis()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE lower(estado_global) = 'activo'),
    'inactive', count(*) FILTER (WHERE lower(estado_global) = 'inactivo'),
    'digital_base', count(*) FILTER (
      WHERE attributes->>'Código SumaGo' IS NOT NULL 
      AND trim(attributes->>'Código SumaGo') <> ''
    ),
    'visible_b2b', count(*) FILTER (WHERE lower(visibilidad_b2b) = 'visible'),
    'visible_b2c', count(*) FILTER (WHERE lower(visibilidad_b2c) = 'visible'),
    'last_updated', max(updated_at)
  )
  FROM pim_records
$$;

-- 2. Add universe_key column to predefined_reports
ALTER TABLE predefined_reports ADD COLUMN universe_key text NOT NULL DEFAULT 'all';
