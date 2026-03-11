ALTER TABLE pim_records ALTER COLUMN estado_global DROP NOT NULL;
ALTER TABLE pim_records ALTER COLUMN estado_global DROP DEFAULT;
ALTER TABLE pim_records ALTER COLUMN visibilidad_b2b DROP NOT NULL;
ALTER TABLE pim_records ALTER COLUMN visibilidad_b2b DROP DEFAULT;
ALTER TABLE pim_records ALTER COLUMN visibilidad_b2c DROP NOT NULL;
ALTER TABLE pim_records ALTER COLUMN visibilidad_b2c DROP DEFAULT;

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
    'digital_base', count(*) FILTER (WHERE 
      codigo_sumago IS NOT NULL AND trim(codigo_sumago) != ''
    ),
    'visible_b2b', count(*) FILTER (WHERE lower(visibilidad_b2b) = 'visible'),
    'visible_b2c', count(*) FILTER (WHERE lower(visibilidad_b2c) = 'visible'),
    'last_updated', max(updated_at)
  )
  FROM pim_records
$$