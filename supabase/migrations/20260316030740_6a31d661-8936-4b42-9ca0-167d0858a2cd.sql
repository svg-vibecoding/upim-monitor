
CREATE TABLE public.dashboard_cards_config (
  card_key text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_cards_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read dashboard_cards_config"
  ON public.dashboard_cards_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "UsuarioPRO can manage dashboard_cards_config"
  ON public.dashboard_cards_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'::app_role));

INSERT INTO public.dashboard_cards_config (card_key, label, config) VALUES
  ('card_1', 'Catálogo', '{"main_value":"total","secondary_1":null,"secondary_1_label":"Activos","secondary_2":null,"secondary_2_label":"Inactivos"}'::jsonb),
  ('card_2', 'Base Digital', '{"main_operation":null,"secondary_1":null,"secondary_1_label":"Visibles B2B","secondary_2":null,"secondary_2_label":"Visibles B2C"}'::jsonb),
  ('card_3', 'Completitud General', '{"report_id":null}'::jsonb);
