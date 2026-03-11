
CREATE OR REPLACE FUNCTION public.get_report_completeness(p_report_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attributes text[];
  v_universe_key text;
  v_result json;
BEGIN
  SELECT attributes, universe_key INTO v_attributes, v_universe_key
  FROM predefined_reports WHERE id = p_report_id;

  IF v_attributes IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Single-pass: scan universe once, count populated per attribute
  WITH universe AS (
    SELECT r.estado_global, r.visibilidad_b2b, r.visibilidad_b2c,
           r.categoria_n1_comercial, r.clasificacion_producto, r.attributes
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
  -- Single pass: for each record, check all attributes at once
  per_record_counts AS (
    SELECT 
      a.attr_name,
      count(*) FILTER (WHERE
        CASE a.attr_name
          WHEN 'Estado (Global)' THEN u.estado_global IS NOT NULL AND trim(u.estado_global) <> ''
          WHEN 'Visibilidad Adobe B2B' THEN u.visibilidad_b2b IS NOT NULL AND trim(u.visibilidad_b2b) <> ''
          WHEN 'Visibilidad Adobe B2C' THEN u.visibilidad_b2c IS NOT NULL AND trim(u.visibilidad_b2c) <> ''
          WHEN 'Categoría N1 Comercial' THEN u.categoria_n1_comercial IS NOT NULL AND trim(u.categoria_n1_comercial) <> ''
          WHEN 'Clasificación del Producto' THEN u.clasificacion_producto IS NOT NULL AND trim(u.clasificacion_producto) <> ''
          ELSE u.attributes->>a.attr_name IS NOT NULL AND trim(u.attributes->>a.attr_name) <> ''
        END
      )::int AS populated
    FROM universe u
    CROSS JOIN attr_list a
    GROUP BY a.attr_name
  )
  SELECT json_agg(json_build_object(
    'name', p.attr_name,
    'totalSKUs', t.cnt,
    'populated', p.populated,
    'completeness', CASE WHEN t.cnt > 0 THEN round((p.populated::numeric / t.cnt) * 100) ELSE 0 END
  ) ORDER BY CASE WHEN t.cnt > 0 THEN round((p.populated::numeric / t.cnt) * 100) ELSE 0 END ASC NULLS LAST)
  INTO v_result
  FROM per_record_counts p
  CROSS JOIN total_count t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;
