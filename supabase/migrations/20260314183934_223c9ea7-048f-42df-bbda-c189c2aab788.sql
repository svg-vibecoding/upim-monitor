
-- Create operations table
CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  logic_mode text NOT NULL DEFAULT 'all',
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_kpi text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_operations_updated_at
  BEFORE UPDATE ON public.operations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read operations"
  ON public.operations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "UsuarioPRO can manage operations"
  ON public.operations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'::app_role));
