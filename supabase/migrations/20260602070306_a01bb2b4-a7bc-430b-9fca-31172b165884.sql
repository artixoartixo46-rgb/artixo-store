
-- 1. Rewrite handle_new_user without the hardcoded admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Allow self-insert of pending_seller (still cannot self-grant admin/seller)
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
CREATE POLICY "Users insert own role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND role = ANY (ARRAY['customer'::app_role, 'pending_seller'::app_role])
);

-- 3. Enforce server-side prices: overwrite unit_price from products table
CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authoritative_price numeric;
BEGIN
  SELECT price INTO authoritative_price FROM public.products WHERE id = NEW.product_id;
  IF authoritative_price IS NULL THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;
  NEW.unit_price := authoritative_price;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_item_price ON public.order_items;
CREATE TRIGGER trg_enforce_order_item_price
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

-- 4. Validate that order total is >= sum of items (shipping can still be added on top)
CREATE OR REPLACE FUNCTION public.validate_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  items_total numeric;
  declared numeric;
BEGIN
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO items_total
  FROM public.order_items WHERE order_id = NEW.order_id;
  SELECT total_amount INTO declared FROM public.orders WHERE id = NEW.order_id;
  IF declared IS NULL OR declared < items_total THEN
    RAISE EXCEPTION 'Order total (%) is less than items subtotal (%)', declared, items_total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_total ON public.order_items;
CREATE TRIGGER trg_validate_order_total
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.validate_order_total();

-- 5. Reasonable bounds on order total
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_total_amount_positive;
ALTER TABLE public.orders ADD CONSTRAINT orders_total_amount_positive
  CHECK (total_amount > 0 AND total_amount < 100000000);
