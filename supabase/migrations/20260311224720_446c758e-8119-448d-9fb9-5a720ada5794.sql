CREATE OR REPLACE FUNCTION public.activate_pim_version(p_upload_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attr_order text[];
  v_required text[] := ARRAY[
    'Estado (Global)',
    'Código SumaGo',
    'Visibilidad Adobe B2B',
    'Visibilidad Adobe B2C'
  ];
  v_missing text[];
  v_staging_count int;
BEGIN
  SELECT attribute_order INTO v_attr_order
  FROM pim_upload_history WHERE id = p_upload_id AND status = 'pending';

  IF v_attr_order IS NULL THEN
    RAISE EXCEPTION 'No se encontró carga pendiente con id %', p_upload_id;
  END IF;

  SELECT array_agg(r) INTO v_missing
  FROM unnest(v_required) r
  WHERE r != ALL(v_attr_order);

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Faltan atributos obligatorios: %', array_to_string(v_missing, ', ');
  END IF;

  SELECT count(*) INTO v_staging_count FROM pim_records_staging;
  IF v_staging_count = 0 THEN
    RAISE EXCEPTION 'No hay registros en staging para activar';
  END IF;

  DELETE FROM pim_records WHERE true;
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

  DELETE FROM pim_records_staging WHERE true;
END;
$function$