
CREATE TABLE IF NOT EXISTS public.pim_records_staging (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_jaivana text NOT NULL,
  estado_global text,
  visibilidad_b2b text,
  visibilidad_b2c text,
  categoria_n1_comercial text,
  clasificacion_producto text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(codigo_jaivana)
);

ALTER TABLE public.pim_records_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert staging" ON public.pim_records_staging FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can select staging" ON public.pim_records_staging FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can delete staging" ON public.pim_records_staging FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can insert staging" ON public.pim_records_staging FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can select staging" ON public.pim_records_staging FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can delete staging" ON public.pim_records_staging FOR DELETE TO authenticated USING (true);
