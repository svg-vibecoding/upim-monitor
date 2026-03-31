
ALTER TABLE predefined_reports ADD COLUMN csv_codes text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.get_report_completeness(p_report_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_attributes text[];
  v_universe_key text;
  v_operation_id uuid;
  v_csv_codes text[];
  v_result json;
  v_where text;
  v_sql text;
BEGIN
  SELECT attributes, universe_key, operation_id, csv_codes
  INTO v_attributes, v_universe_key, v_operation_id, v_csv_codes
  FROM predefined_reports WHERE id = p_report_id;

  IF v_attributes IS NULL THEN RETURN '[]'::json; END IF;
  IF array_length(v_attributes, 1) IS NULL OR array_length(v_attributes, 1) = 0 THEN
    RETURN '[]'::json;
  END IF;

  -- Build WHERE clause: operation_id > csv_codes > universe_key > all
  IF v_operation_id IS NOT NULL THEN
    v_where := build_operation_where(v_operation_id);
  ELSIF v_csv_codes IS NOT NULL AND array_length(v_csv_codes, 1) > 0 THEN
    v_where := 'codigo_jaivana = ANY(' || quote_literal(v_csv_codes::text) || '::text[])';
  ELSE
    v_where := CASE v_universe_key
      WHEN 'active' THEN 'lower(estado_global) = ''activo'''
      WHEN 'visible_b2b' THEN 'lower(visibilidad_b2b) = ''visible'''
      WHEN 'visible_b2c' THEN 'lower(visibilidad_b2c) = ''visible'''
      WHEN 'digital_base' THEN 'attributes->>''Código SumaGo'' IS NOT NULL AND trim(attributes->>''Código SumaGo'') <> '''''
      WHEN 'producto_foco' THEN 'upper(trim(attributes->>''Producto foco'')) = ''SI'''
      ELSE 'true'
    END;
  END IF;

  v_sql := '
    WITH universe AS (
      SELECT estado_global, visibilidad_b2b, visibilidad_b2c,
             categoria_n1_comercial, clasificacion_producto, attributes
      FROM pim_records
      WHERE ' || v_where || '
    ),
    total_count AS (
      SELECT count(*)::int AS cnt FROM universe
    ),
    attr_list AS (
      SELECT unnest($1::text[]) AS attr_name
    ),
    per_record_counts AS (
      SELECT
        a.attr_name,
        count(*) FILTER (WHERE
          CASE a.attr_name
            WHEN ''Estado (Global)'' THEN u.estado_global IS NOT NULL AND trim(u.estado_global) <> ''''
            WHEN ''Visibilidad Adobe B2B'' THEN u.visibilidad_b2b IS NOT NULL AND trim(u.visibilidad_b2b) <> ''''
            WHEN ''Visibilidad Adobe B2C'' THEN u.visibilidad_b2c IS NOT NULL AND trim(u.visibilidad_b2c) <> ''''
            WHEN ''Categoría N1 Comercial'' THEN u.categoria_n1_comercial IS NOT NULL AND trim(u.categoria_n1_comercial) <> ''''
            WHEN ''Clasificación del Producto'' THEN u.clasificacion_producto IS NOT NULL AND trim(u.clasificacion_producto) <> ''''
            ELSE u.attributes->>a.attr_name IS NOT NULL AND trim(u.attributes->>a.attr_name) <> ''''
          END
        )::int AS populated
      FROM universe u
      CROSS JOIN attr_list a
      GROUP BY a.attr_name
    )
    SELECT json_agg(json_build_object(
      ''name'', p.attr_name,
      ''totalSKUs'', t.cnt,
      ''populated'', p.populated,
      ''completeness'', CASE WHEN t.cnt > 0 THEN round((p.populated::numeric / t.cnt) * 100) ELSE 0 END,
      ''rawCompleteness'', CASE WHEN t.cnt > 0 THEN (p.populated::numeric / t.cnt) * 100 ELSE 0 END
    ) ORDER BY CASE WHEN t.cnt > 0 THEN round((p.populated::numeric / t.cnt) * 100) ELSE 0 END ASC NULLS LAST)
    FROM per_record_counts p
    CROSS JOIN total_count t';

  EXECUTE v_sql USING v_attributes INTO v_result;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;
