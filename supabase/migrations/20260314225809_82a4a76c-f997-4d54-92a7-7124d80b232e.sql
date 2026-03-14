
-- ================================================================
-- PHASE A: Dynamic SQL for operation evaluation
-- ================================================================

-- 1. build_operation_where: translates JSONB conditions to native SQL WHERE
CREATE OR REPLACE FUNCTION public.build_operation_where(p_operation_id uuid, p_depth int DEFAULT 0)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conditions jsonb;
  v_logic_mode text;
  v_cond jsonb;
  v_source_type text;
  v_attribute text;
  v_operator text;
  v_value text;
  v_col_expr text;
  v_cond_sql text;
  v_parts text[] := '{}';
  v_joiner text;
  v_sub_where text;
BEGIN
  IF p_depth > 10 THEN RETURN 'false'; END IF;

  SELECT conditions, logic_mode INTO v_conditions, v_logic_mode
  FROM operations WHERE id = p_operation_id;

  IF NOT FOUND THEN RETURN 'false'; END IF;
  IF jsonb_array_length(v_conditions) = 0 THEN RETURN 'true'; END IF;

  v_joiner := CASE WHEN v_logic_mode = 'any' THEN ' OR ' ELSE ' AND ' END;

  FOR v_cond IN SELECT jsonb_array_elements(v_conditions)
  LOOP
    v_source_type := COALESCE(v_cond->>'sourceType', 'attribute');
    v_attribute := v_cond->>'attribute';
    v_operator := v_cond->>'operator';
    v_value := v_cond->>'value';

    IF v_source_type = 'operation' THEN
      -- Recursive: build WHERE for referenced operation
      v_sub_where := build_operation_where(v_attribute::uuid, p_depth + 1);
      IF v_operator = 'not_meets_operation' THEN
        v_cond_sql := 'NOT (' || v_sub_where || ')';
      ELSE
        v_cond_sql := '(' || v_sub_where || ')';
      END IF;
    ELSE
      -- Map attribute name to column expression
      v_col_expr := CASE v_attribute
        WHEN 'Estado (Global)' THEN 'estado_global'
        WHEN 'Visibilidad Adobe B2B' THEN 'visibilidad_b2b'
        WHEN 'Visibilidad Adobe B2C' THEN 'visibilidad_b2c'
        WHEN 'Categoría N1 Comercial' THEN 'categoria_n1_comercial'
        WHEN 'Clasificación del Producto' THEN 'clasificacion_producto'
        WHEN 'Código Jaivaná' THEN 'codigo_jaivana'
        ELSE 'attributes->>' || quote_literal(v_attribute)
      END;

      v_cond_sql := CASE v_operator
        WHEN 'has_value' THEN
          '(' || v_col_expr || ' IS NOT NULL AND trim(' || v_col_expr || ') <> '''')'
        WHEN 'no_value' THEN
          '(' || v_col_expr || ' IS NULL OR trim(' || v_col_expr || ') = '''')'
        WHEN 'equals' THEN
          '(' || v_col_expr || ' IS NOT NULL AND lower(' || v_col_expr || ') = lower(' || quote_literal(COALESCE(v_value, '')) || '))'
        WHEN 'not_equals' THEN
          '(' || v_col_expr || ' IS NULL OR lower(' || v_col_expr || ') <> lower(' || quote_literal(COALESCE(v_value, '')) || '))'
        WHEN 'contains' THEN
          '(' || v_col_expr || ' IS NOT NULL AND lower(' || v_col_expr || ') LIKE ''%'' || lower(' || quote_literal(COALESCE(v_value, '')) || ') || ''%'')'
        WHEN 'not_contains' THEN
          '(' || v_col_expr || ' IS NULL OR lower(' || v_col_expr || ') NOT LIKE ''%'' || lower(' || quote_literal(COALESCE(v_value, '')) || ') || ''%'')'
        ELSE 'false'
      END;
    END IF;

    v_parts := array_append(v_parts, v_cond_sql);
  END LOOP;

  IF array_length(v_parts, 1) IS NULL OR array_length(v_parts, 1) = 0 THEN
    RETURN 'true';
  END IF;

  RETURN '(' || array_to_string(v_parts, v_joiner) || ')';
END;
$function$;

-- 2. Rewrite get_report_completeness to use dynamic SQL for operations
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
  v_result json;
  v_where text;
  v_sql text;
BEGIN
  SELECT attributes, universe_key, operation_id
  INTO v_attributes, v_universe_key, v_operation_id
  FROM predefined_reports WHERE id = p_report_id;

  IF v_attributes IS NULL THEN RETURN '[]'::json; END IF;
  IF array_length(v_attributes, 1) IS NULL OR array_length(v_attributes, 1) = 0 THEN
    RETURN '[]'::json;
  END IF;

  -- Build WHERE clause for universe filtering
  IF v_operation_id IS NOT NULL THEN
    v_where := build_operation_where(v_operation_id);
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

  -- Build and execute dynamic query
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
      ''completeness'', CASE WHEN t.cnt > 0 THEN round((p.populated::numeric / t.cnt) * 100) ELSE 0 END
    ) ORDER BY CASE WHEN t.cnt > 0 THEN round((p.populated::numeric / t.cnt) * 100) ELSE 0 END ASC NULLS LAST)
    FROM per_record_counts p
    CROSS JOIN total_count t';

  EXECUTE v_sql USING v_attributes INTO v_result;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

-- 3. get_operation_count: returns count of records matching an operation
CREATE OR REPLACE FUNCTION public.get_operation_count(p_operation_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_where text;
  v_count integer;
BEGIN
  v_where := build_operation_where(p_operation_id);
  EXECUTE 'SELECT count(*)::int FROM pim_records WHERE ' || v_where INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- ================================================================
-- PHASE B: Precomputation layer
-- ================================================================

-- 4. computed_results table
CREATE TABLE IF NOT EXISTS public.computed_results (
  result_type text NOT NULL,
  entity_id text NOT NULL DEFAULT '__global__',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (result_type, entity_id)
);

ALTER TABLE public.computed_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read computed_results"
  ON public.computed_results FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Anon can read computed_results"
  ON public.computed_results FOR SELECT
  TO anon USING (true);

-- Service role / security definer functions will write to this table

-- 5. refresh_computed_result: recalculates a single result
CREATE OR REPLACE FUNCTION public.refresh_computed_result(p_type text, p_entity_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_key text := COALESCE(p_entity_id, '__global__');
  v_result jsonb;
BEGIN
  CASE p_type
    WHEN 'dashboard_kpis' THEN
      SELECT get_pim_kpis()::jsonb INTO v_result;
    WHEN 'report_completeness' THEN
      IF p_entity_id IS NULL THEN RETURN; END IF;
      SELECT get_report_completeness(p_entity_id::uuid)::jsonb INTO v_result;
    WHEN 'operation_count' THEN
      IF p_entity_id IS NULL THEN RETURN; END IF;
      SELECT to_jsonb(get_operation_count(p_entity_id::uuid)) INTO v_result;
    ELSE
      RETURN;
  END CASE;

  INSERT INTO computed_results (result_type, entity_id, result, computed_at)
  VALUES (p_type, v_key, COALESCE(v_result, '{}'::jsonb), now())
  ON CONFLICT (result_type, entity_id)
  DO UPDATE SET result = COALESCE(v_result, '{}'::jsonb), computed_at = now();
END;
$function$;

-- 6. refresh_all_computed_results: recalculates everything (for PIM activation)
CREATE OR REPLACE FUNCTION public.refresh_all_computed_results()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_report record;
  v_op record;
BEGIN
  -- Dashboard KPIs
  PERFORM refresh_computed_result('dashboard_kpis');

  -- All predefined reports
  FOR v_report IN SELECT id::text FROM predefined_reports LOOP
    PERFORM refresh_computed_result('report_completeness', v_report.id);
  END LOOP;

  -- All operations with linked_kpi
  FOR v_op IN SELECT id::text FROM operations WHERE linked_kpi IS NOT NULL AND active = true LOOP
    PERFORM refresh_computed_result('operation_count', v_op.id);
  END LOOP;
END;
$function$;
