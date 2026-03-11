ALTER TABLE pim_records DROP COLUMN codigo_sumago;

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
    'digital_base', 0,
    'visible_b2b', count(*) FILTER (WHERE lower(visibilidad_b2b) = 'visible'),
    'visible_b2c', count(*) FILTER (WHERE lower(visibilidad_b2c) = 'visible'),
    'last_updated', max(updated_at)
  )
  FROM pim_records
$$;