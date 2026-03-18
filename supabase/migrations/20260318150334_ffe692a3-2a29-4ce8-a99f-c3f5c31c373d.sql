CREATE OR REPLACE FUNCTION public.truncate_pim_staging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  TRUNCATE pim_records_staging;
END;
$$;