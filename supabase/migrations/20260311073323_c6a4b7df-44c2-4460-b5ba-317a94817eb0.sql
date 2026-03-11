
CREATE OR REPLACE FUNCTION public.get_report_completeness(p_report_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attributes text[];
  v_universe_key text;
  v_result json;
BEGIN
  -- Get report config
  SELECT attributes, universe_key INTO v_attributes, v_universe_key
  FROM predefined_reports WHERE id = p_report_id;

  IF v_attributes IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Compute completeness per attribute, filtering by universe
  WITH universe AS (
    SELECT r.*
    FROM pim_records r
    WHERE CASE v_universe_key
      WHEN 'active' THEN lower(r.estado_global) = 'activo'
      WHEN 'visible_b2b' THEN lower(r.visibilidad_b2b) = 'visible'
      WHEN 'visible_b2c' THEN lower(r.visibilidad_b2c) = 'visible'
      WHEN 'digital_base' THEN r.attributes->>'Código SumaGo' IS NOT NULL 
                               AND trim(r.attributes->>'Código SumaGo') <> ''
      ELSE true
    END
  ),
  total_count AS (
    SELECT count(*)::int AS cnt FROM universe
  ),
  attr_list AS (
    SELECT unnest(v_attributes) AS attr_name
  ),
  completeness AS (
    SELECT 
      a.attr_name,
      t.cnt AS total_skus,
      (SELECT count(*)::int FROM universe u 
       WHERE CASE a.attr_name
         WHEN 'Estado (Global)' THEN u.estado_global IS NOT NULL AND trim(u.estado_global) <> ''
         WHEN 'Visibilidad Adobe B2B' THEN u.visibilidad_b2b IS NOT NULL AND trim(u.visibilidad_b2b) <> ''
         WHEN 'Visibilidad Adobe B2C' THEN u.visibilidad_b2c IS NOT NULL AND trim(u.visibilidad_b2c) <> ''
         WHEN 'Categoría N1 Comercial' THEN u.categoria_n1_comercial IS NOT NULL AND trim(u.categoria_n1_comercial) <> ''
         WHEN 'Clasificación del Producto' THEN u.clasificacion_producto IS NOT NULL AND trim(u.clasificacion_producto) <> ''
         ELSE u.attributes->>a.attr_name IS NOT NULL AND trim(u.attributes->>a.attr_name) <> ''
       END
      ) AS populated
    FROM attr_list a
    CROSS JOIN total_count t
  )
  SELECT json_agg(json_build_object(
    'name', c.attr_name,
    'totalSKUs', c.total_skus,
    'populated', c.populated,
    'completeness', CASE WHEN c.total_skus > 0 THEN round((c.populated::numeric / c.total_skus) * 100) ELSE 0 END
  ) ORDER BY round((c.populated::numeric / NULLIF(c.total_skus, 0)) * 100) ASC NULLS LAST)
  INTO v_result
  FROM completeness c;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
