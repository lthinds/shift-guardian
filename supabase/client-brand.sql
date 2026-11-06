ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'reggra';
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_brand_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_brand_check CHECK (brand IN ('reggra','safenet'));
CREATE OR REPLACE FUNCTION public.guard_client_brand() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.brand <> 'reggra' AND NOT public.has_role(auth.uid(), 'admin') THEN NEW.brand := 'reggra'; END IF;
  ELSIF NEW.brand IS DISTINCT FROM OLD.brand AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem alterar a empresa do cliente';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_client_brand ON public.clients;
CREATE TRIGGER guard_client_brand BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_client_brand();