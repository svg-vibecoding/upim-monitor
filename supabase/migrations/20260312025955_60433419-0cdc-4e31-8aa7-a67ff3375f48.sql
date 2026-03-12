
-- Usage events table for analytics
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid NOT NULL,
  user_email text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  report_id text,
  report_name text,
  report_type text,
  source_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for time-based queries
CREATE INDEX idx_usage_events_created_at ON public.usage_events (created_at DESC);
CREATE INDEX idx_usage_events_user_id ON public.usage_events (user_id);
CREATE INDEX idx_usage_events_event_type ON public.usage_events (event_type);

-- Enable RLS
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert events (their own)
CREATE POLICY "Authenticated can insert own events"
ON public.usage_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Only usuario_pro can read all events
CREATE POLICY "UsuarioPRO can read all events"
ON public.usage_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'usuario_pro'::app_role));
