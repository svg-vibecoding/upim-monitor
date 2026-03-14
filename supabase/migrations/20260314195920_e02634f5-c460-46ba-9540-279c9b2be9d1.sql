
-- Add operation_id to predefined_reports
ALTER TABLE predefined_reports ADD COLUMN operation_id uuid REFERENCES operations(id) ON DELETE SET NULL;

-- Helper: get attribute value from a pim_record row
CREATE OR REPLACE FUNCTION get_record_attr_value(
  p_record pim_records,
  p_attr_name text
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE p_attr_name
    WHEN 'Estado (Global)' THEN p_record.estado_global
    WHEN 'Visibilidad Adobe B2B' THEN p_record.visibilidad_b2b
    WHEN 'Visibilidad Adobe B2C' THEN p_record.visibilidad_b2c
    WHEN 'Categoría N1 Comercial' THEN p_record.categoria_n1_comercial
    WHEN 'Clasificación del Producto' THEN p_record.clasificacion_producto
    WHEN 'Código Jaivaná' THEN p_record.codigo_jaivana
    ELSE p_record.attributes->>p_attr_name
  END;
$$;

-- Recursive operation evaluator for server-side filtering
CREATE OR REPLACE FUNCTION evaluate_record_against_operation(
  p_record pim_records,
  p_operation_id uuid,
  p_depth int DEFAULT 0
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_conditions jsonb;
  v_logic_mode text;
  v_cond jsonb;
  v_source_type text;
  v_attribute text;
  v_operator text;
  v_value text;
  v_raw_val text;
  v_is_empty boolean;
  v_cond_result boolean;
BEGIN
  IF p_depth > 10 THEN RETURN false; END IF;

  SELECT conditions, logic_mode INTO v_conditions, v_logic_mode
  FROM operations WHERE id = p_operation_id;

  IF NOT FOUND THEN RETURN false; END IF;
  IF jsonb_array_length(v_conditions) = 0 THEN RETURN true; END IF;

  FOR v_cond IN SELECT jsonb_array_elements(v_conditions)
  LOOP
    v_source_type := COALESCE(v_cond->>'sourceType', 'attribute');
    v_attribute := v_cond->>'attribute';
    v_operator := v_cond->>'operator';
    v_value := v_cond->>'value';

    IF v_source_type = 'operation' THEN
      v_cond_result := evaluate_record_against_operation(p_record, v_attribute::uuid, p_depth + 1);
      IF v_operator = 'not_meets_operation' THEN v_cond_result := NOT v_cond_result; END IF;
    ELSE
      v_raw_val := get_record_attr_value(p_record, v_attribute);
      v_is_empty := v_raw_val IS NULL OR trim(v_raw_val) = '';

      v_cond_result := CASE v_operator
        WHEN 'has_value' THEN NOT v_is_empty
        WHEN 'no_value' THEN v_is_empty
        WHEN 'equals' THEN NOT v_is_empty AND lower(v_raw_val) = lower(COALESCE(v_value, ''))
        WHEN 'not_equals' THEN v_is_empty OR lower(v_raw_val) != lower(COALESCE(v_value, ''))
        WHEN 'contains' THEN NOT v_is_empty AND lower(v_raw_val) LIKE '%' || lower(COALESCE(v_value, '')) || '%'
        WHEN 'not_contains' THEN v_is_empty OR lower(v_raw_val) NOT LIKE '%' || lower(COALESCE(v_value, '')) || '%'
        ELSE false
      END;
    END IF;

    IF v_logic_mode = 'any' AND v_cond_result THEN RETURN true; END IF;
    IF v_logic_mode = 'all' AND NOT v_cond_result THEN RETURN false; END IF;
  END LOOP;

  RETURN v_logic_mode = 'all';
END;
$$;

-- Update get_report_completeness to support operation-based universe filtering
CREATE OR REPLACE FUNCTION get_report_completeness(p_report_id uuid)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_attributes text[];
  v_universe_key text;
  v_operation_id uuid;
  v_result json;
BEGIN
  SELECT attributes, universe_key, operation_id
  INTO v_attributes, v_universe_key, v_operation_id
  FROM predefined_reports WHERE id = p_report_id;

  IF v_attributes IS NULL THEN RETURN '[]'::json; END IF;
  IF array_length(v_attributes, 1) IS NULL OR array_length(v_attributes, 1) = 0 THEN
    RETURN '[]'::json;
  END IF;

  WITH universe AS (
    SELECT r.estado_global, r.visibilidad_b2b, r.visibilidad_b2c,
           r.categoria_n1_comercial, r.clasificacion_producto, r.attributes
    FROM pim_records r
    WHERE
      CASE
        WHEN v_operation_id IS NOT NULL THEN
          evaluate_record_against_operation(r, v_operation_id)
        ELSE
          CASE v_universe_key
            WHEN 'active' THEN lower(r.estado_global) = 'activo'
            WHEN 'visible_b2b' THEN lower(r.visibilidad_b2b) = 'visible'
            WHEN 'visible_b2c' THEN lower(r.visibilidad_b2c) = 'visible'
            WHEN 'digital_base' THEN r.attributes->>'Código SumaGo' IS NOT NULL
                                     AND trim(r.attributes->>'Código SumaGo') <> ''
            WHEN 'producto_foco' THEN upper(trim(r.attributes->>'Producto foco')) = 'SI'
            ELSE true
          END
      END
  ),
  total_count AS (
    SELECT count(*)::int AS cnt FROM universe
  ),
  attr_list AS (
    SELECT unnest(v_attributes) AS attr_name
  ),
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
$$;

-- Create equivalent operations for existing universe_keys and link to reports
DO $$
DECLARE
  v_op_id uuid;
  v_uk text;
  v_name text;
  v_desc text;
  v_cond jsonb;
BEGIN
  FOR v_uk, v_name, v_desc, v_cond IN
    VALUES
      ('active', 'SKUs Activos', 'Productos con Estado (Global) = Activo',
        '[{"sourceType":"attribute","attribute":"Estado (Global)","operator":"equals","value":"Activo"}]'::jsonb),
      ('digital_base', 'Base Digital', 'Productos con Código SumaGo poblado',
        '[{"sourceType":"attribute","attribute":"Código SumaGo","operator":"has_value","value":null}]'::jsonb),
      ('visible_b2b', 'Visibles B2B', 'Productos con Visibilidad Adobe B2B = Visible',
        '[{"sourceType":"attribute","attribute":"Visibilidad Adobe B2B","operator":"equals","value":"Visible"}]'::jsonb),
      ('visible_b2c', 'Visibles B2C', 'Productos con Visibilidad Adobe B2C = Visible',
        '[{"sourceType":"attribute","attribute":"Visibilidad Adobe B2C","operator":"equals","value":"Visible"}]'::jsonb),
      ('producto_foco', 'Portafolio Foco', 'Productos con Producto foco = SI',
        '[{"sourceType":"attribute","attribute":"Producto foco","operator":"equals","value":"SI"}]'::jsonb)
  LOOP
    -- Only create if there are reports with this universe_key
    IF EXISTS (SELECT 1 FROM predefined_reports WHERE universe_key = v_uk AND operation_id IS NULL) THEN
      INSERT INTO operations (name, description, logic_mode, conditions, active)
      VALUES (v_name, v_desc, 'all', v_cond, true)
      RETURNING id INTO v_op_id;

      UPDATE predefined_reports SET operation_id = v_op_id WHERE universe_key = v_uk AND operation_id IS NULL;
    END IF;
  END LOOP;
END;
$$;
