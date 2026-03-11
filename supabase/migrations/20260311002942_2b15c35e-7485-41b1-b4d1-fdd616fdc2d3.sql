CREATE OR REPLACE FUNCTION public.get_pim_kpis()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE 
      COALESCE(NULLIF(estado_global, 'Activo'), attributes->>'Estado (Global)') IS NOT NULL 
      AND lower(COALESCE(NULLIF(CASE WHEN estado_global = 'Activo' AND attributes->>'Estado (Global)' IS NOT NULL THEN attributes->>'Estado (Global)' ELSE estado_global END, ''), '')) = 'activo'
    ),
    'inactive', count(*) FILTER (WHERE 
      lower(COALESCE(CASE WHEN estado_global = 'Activo' AND attributes->>'Estado (Global)' IS NOT NULL THEN attributes->>'Estado (Global)' ELSE estado_global END, '')) = 'inactivo'
    ),
    'digital_base', count(*) FILTER (WHERE 
      COALESCE(codigo_sumago, attributes->>'SumaGO') IS NOT NULL 
      AND trim(COALESCE(codigo_sumago, attributes->>'SumaGO', '')) != ''
    ),
    'visible_b2b', count(*) FILTER (WHERE 
      lower(COALESCE(CASE WHEN visibilidad_b2b = 'Oculto' AND attributes->>'Visibilidad Adobe B2B' IS NOT NULL THEN attributes->>'Visibilidad Adobe B2B' ELSE visibilidad_b2b END, '')) = 'visible'
    ),
    'visible_b2c', count(*) FILTER (WHERE 
      lower(COALESCE(CASE WHEN visibilidad_b2c = 'Oculto' AND attributes->>'Visibilidad Adobe B2C' IS NOT NULL THEN attributes->>'Visibilidad Adobe B2C' ELSE visibilidad_b2c END, '')) = 'visible'
    ),
    'last_updated', max(updated_at)
  )
  FROM pim_records
  WHERE attributes->>'Estado (Global)' IS NOT NULL
     OR (estado_global IS NOT NULL AND estado_global != 'Activo')
$$;
