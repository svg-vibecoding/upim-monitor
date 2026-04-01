
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

  FOR v_dim IN SELECT id::text FROM dimensions WHERE active = true LOOP
    PERFORM refresh_computed_result('dimension_values', v_dim.id);
  END LOOP;
END;
$function$;
