
-- 1. Enum for roles
CREATE TYPE public.app_role AS ENUM ('pim_manager', 'usuario_pro');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table (separate from profiles per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. PIM records table
CREATE TABLE public.pim_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_jaivana TEXT UNIQUE NOT NULL,
  estado_global TEXT NOT NULL DEFAULT 'Activo',
  codigo_sumago TEXT,
  visibilidad_b2b TEXT NOT NULL DEFAULT 'Oculto',
  visibilidad_b2c TEXT NOT NULL DEFAULT 'Oculto',
  categoria_n1_comercial TEXT,
  clasificacion_producto TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pim_records ENABLE ROW LEVEL SECURITY;

-- 6. Predefined reports table
CREATE TABLE public.predefined_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  universe TEXT NOT NULL DEFAULT '',
  attributes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.predefined_reports ENABLE ROW LEVEL SECURITY;

-- 7. Dimensions table
CREATE TABLE public.dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  field TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;

-- === RLS POLICIES ===

-- Profiles: authenticated users can read all profiles
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Profiles: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Profiles: usuario_pro can insert/update/delete profiles
CREATE POLICY "UsuarioPRO can manage profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'));

-- User roles: authenticated can read
CREATE POLICY "Authenticated can read roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

-- User roles: only usuario_pro can manage
CREATE POLICY "UsuarioPRO can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'));

-- PIM records: all authenticated can read
CREATE POLICY "Authenticated can read pim_records"
  ON public.pim_records FOR SELECT TO authenticated
  USING (true);

-- PIM records: only usuario_pro can insert/update/delete
CREATE POLICY "UsuarioPRO can manage pim_records"
  ON public.pim_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'));

-- Predefined reports: all authenticated can read
CREATE POLICY "Authenticated can read reports"
  ON public.predefined_reports FOR SELECT TO authenticated
  USING (true);

-- Predefined reports: only usuario_pro can manage
CREATE POLICY "UsuarioPRO can manage reports"
  ON public.predefined_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'));

-- Dimensions: all authenticated can read
CREATE POLICY "Authenticated can read dimensions"
  ON public.dimensions FOR SELECT TO authenticated
  USING (true);

-- Dimensions: only usuario_pro can manage
CREATE POLICY "UsuarioPRO can manage dimensions"
  ON public.dimensions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'usuario_pro'));

-- === TRIGGER for updated_at ===
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pim_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.predefined_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- === Auto-create profile on signup ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
