
DROP FUNCTION IF EXISTS public.activate_pim_version(uuid);

CREATE OR REPLACE FUNCTION public.activate_pim_version(p_upload_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_attr_order text[];
  v_required text[];
  v_missing text[];
  v_staging_count int;
  v_full_attrs text[];
  v_removed_attrs text[];
  v_reports_cleaned int := 0;
  v_ops_deactivated text[];
  v_dims_deactivated text[];
BEGIN
  SELECT attribute_order INTO v_attr_order
  FROM pim_upload_history WHERE id = p_upload_id AND status = 'pending';

  IF v_attr_order IS NULL THEN
    RAISE EXCEPTION 'No se encontró carga pendiente con id %', p_upload_id;
  END IF;

  SELECT array_agg(DISTINCT attr) INTO v_required
  FROM (
    SELECT CASE universe_key
      WHEN 'active' THEN 'Estado (Global)'
      WHEN 'digital_base' THEN 'Código SumaGo'
      WHEN 'visible_b2b' THEN 'Visibilidad Adobe B2B'
      WHEN 'visible_b2c' THEN 'Visibilidad Adobe B2C'
      WHEN 'producto_foco' THEN 'Producto foco'
    END AS attr
    FROM predefined_reports
    WHERE universe_key NOT IN ('all', 'active_all')
      AND universe_key IS NOT NULL
    UNION
    SELECT DISTINCT field AS attr
    FROM dimensions
    WHERE active = true
  ) sub
  WHERE attr IS NOT NULL;

  IF v_required IS NOT NULL AND array_length(v_required, 1) > 0 THEN
    SELECT array_agg(r) INTO v_missing
    FROM unnest(v_required) r
    WHERE r != ALL(v_attr_order);

    IF array_length(v_missing, 1) > 0 THEN
      RAISE EXCEPTION 'Faltan atributos obligatorios: %', array_to_string(v_missing, ', ');
    END IF;
  END IF;

  SELECT count(*) INTO v_staging_count FROM pim_records_staging;
  IF v_staging_count = 0 THEN
    RAISE EXCEPTION 'No hay registros en staging para activar';
  END IF;

  TRUNCATE pim_records;
  INSERT INTO pim_records (id, codigo_jaivana, estado_global, visibilidad_b2b,
    visibilidad_b2c, categoria_n1_comercial, clasificacion_producto,
    attributes, created_at, updated_at)
  SELECT id, codigo_jaivana, estado_global, visibilidad_b2b,
    visibilidad_b2c, categoria_n1_comercial, clasificacion_producto,
    attributes, created_at, updated_at
  FROM pim_records_staging;

  UPDATE pim_metadata SET attribute_order = v_attr_order, updated_at = now()
  WHERE id = 'singleton';

  UPDATE pim_upload_history SET status = 'discarded' WHERE status = 'active';
  UPDATE pim_upload_history SET status = 'active' WHERE id = p_upload_id;

  TRUNCATE pim_records_staging;

  -- === ORPHAN CLEANUP ===
  v_full_attrs := v_attr_order || ARRAY[
    'Estado (Global)', 'Visibilidad Adobe B2B', 'Visibilidad Adobe B2C',
    'Categoría N1 Comercial', 'Clasificación del Producto', 'Código Jaivaná'
  ];

  SELECT COALESCE(array_agg(DISTINCT a), '{}') INTO v_removed_attrs
  FROM predefined_reports, unnest(attributes) a
  WHERE a != ALL(v_full_attrs);

  WITH cleaned AS (
    UPDATE predefined_reports
    SET attributes = COALESCE((
      SELECT array_agg(a ORDER BY array_position(attributes, a))
      FROM unnest(attributes) a
      WHERE a = ANY(v_full_attrs)
    ), '{}')
    WHERE EXISTS (
      SELECT 1 FROM unnest(attributes) a WHERE a != ALL(v_full_attrs)
    )
    RETURNING id
  )
  SELECT count(*) INTO v_reports_cleaned FROM cleaned;

  WITH deactivated AS (
    UPDATE operations SET active = false
    WHERE active = true
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(conditions) c
      WHERE COALESCE(c->>'sourceType','attribute') = 'attribute'
      AND c->>'attribute' IS NOT NULL
      AND c->>'attribute' != ''
      AND NOT (c->>'attribute' = ANY(v_full_attrs))
    )
    RETURNING name
  )
  SELECT COALESCE(array_agg(name), '{}') INTO v_ops_deactivated FROM deactivated;

  WITH deactivated AS (
    UPDATE dimensions SET active = false
    WHERE active = true
    AND field != ALL(v_full_attrs)
    RETURNING name
  )
  SELECT COALESCE(array_agg(name), '{}') INTO v_dims_deactivated FROM deactivated;

  RETURN json_build_object(
    'reportsCleanedCount', v_reports_cleaned,
    'removedAttributes', v_removed_attrs,
    'operationsDeactivated', v_ops_deactivated,
    'dimensionsDeactivated', v_dims_deactivated
  );
END;
$function$;
