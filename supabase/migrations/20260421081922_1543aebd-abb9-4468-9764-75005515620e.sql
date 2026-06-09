-- Fix infinite recursion between orders <-> order_items policies
-- Root cause: orders SELECT policy queries order_items, and order_items SELECT policy queries orders.

-- Helper: return order_ids that contain products from a given seller (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_seller_of_order(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = _order_id AND seller_id = _user_id
  )
$$;

-- Helper: check if user owns an order (SECURITY DEFINER bypasses RLS on orders)
CREATE OR REPLACE FUNCTION public.is_order_customer(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = _order_id AND customer_id = _user_id
  )
$$;

-- Rewrite orders SELECT policy
DROP POLICY IF EXISTS "Customers see own orders" ON public.orders;
CREATE POLICY "Customers see own orders"
ON public.orders
FOR SELECT
USING (
  auth.uid() = customer_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_seller_of_order(id, auth.uid())
);

-- Rewrite orders UPDATE policy
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders"
ON public.orders
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_seller_of_order(id, auth.uid())
);

-- Rewrite order_items SELECT policy to avoid querying orders directly
DROP POLICY IF EXISTS "Order items visibility" ON public.order_items;
CREATE POLICY "Order items visibility"
ON public.order_items
FOR SELECT
USING (
  auth.uid() = seller_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_order_customer(order_id, auth.uid())
);

-- Rewrite order_items INSERT policy similarly
DROP POLICY IF EXISTS "Order items insert with order" ON public.order_items;
CREATE POLICY "Order items insert with order"
ON public.order_items
FOR INSERT
WITH CHECK (public.is_order_customer(order_id, auth.uid()));