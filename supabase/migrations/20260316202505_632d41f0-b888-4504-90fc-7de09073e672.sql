
-- 1. Create function to get unique values for a dimension field
CREATE OR REPLACE FUNCTION public.get_dimension_unique_values(p_dimension_field text)
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT trim(val) AS val
  FROM (
    SELECT CASE p_dimension_field
      WHEN 'Estado (Global)' THEN estado_global
      WHEN 'Visibilidad Adobe B2B' THEN visibilidad_b2b
      WHEN 'Visibilidad Adobe B2C' THEN visibilidad_b2c
      WHEN 'Categoría N1 Comercial' THEN categoria_n1_comercial
      WHEN 'Clasificación del Producto' THEN clasificacion_producto
      WHEN 'Código Jaivaná' THEN codigo_jaivana
      ELSE attributes->>p_dimension_field
    END AS val
    FROM pim_records
  ) sub
  WHERE val IS NOT NULL AND trim(val) <> ''
  ORDER BY val;
$$;

-- 2. Update refresh_computed_result to handle 'dimension_values'
CREATE OR REPLACE FUNCTION public.refresh_computed_result(p_type text, p_entity_id text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_key text := COALESCE(p_entity_id, '__global__');
  v_result jsonb;
  v_dim_field text;
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
    WHEN 'dimension_values' THEN
      IF p_entity_id IS NULL THEN RETURN; END IF;
      SELECT field INTO v_dim_field FROM dimensions WHERE id = p_entity_id::uuid;
      IF v_dim_field IS NULL THEN RETURN; END IF;
      SELECT to_jsonb(array_agg(v)) INTO v_result FROM get_dimension_unique_values(v_dim_field) v;
      v_result := COALESCE(v_result, '[]'::jsonb);
    ELSE
      RETURN;
  END CASE;

  INSERT INTO computed_results (result_type, entity_id, result, computed_at)
  VALUES (p_type, v_key, COALESCE(v_result, '{}'::jsonb), now())
  ON CONFLICT (result_type, entity_id)
  DO UPDATE SET result = COALESCE(v_result, '{}'::jsonb), computed_at = now();
END;
$function$;

-- 3. Update refresh_all_computed_results to include dimensions
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
  v_dim record;
BEGIN
  PERFORM refresh_computed_result('dashboard_kpis');

  FOR v_report IN SELECT id::text FROM predefined_reports LOOP
    PERFORM refresh_computed_result('report_completeness', v_report.id);
  END LOOP;

  FOR v_op IN SELECT id::text FROM operations WHERE active = true LOOP
    PERFORM refresh_computed_result('operation_count', v_op.id);
  END LOOP;

  FOR v_dim IN SELECT id::text FROM dimensions LOOP
    PERFORM refresh_computed_result('dimension_values', v_dim.id);
  END LOOP;
END;
$function$;
