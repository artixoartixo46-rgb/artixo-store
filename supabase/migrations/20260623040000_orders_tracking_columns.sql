-- Add missing tracking columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS courier TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Also apply the seller_commission migration columns if not already there
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 8.00;

-- Create withdrawals table if not exists
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gross_amount    NUMERIC(12,2) NOT NULL,
  commission      NUMERIC(12,2) NOT NULL,
  net_amount      NUMERIC(12,2) NOT NULL,
  bank_name       TEXT,
  account_number  TEXT,
  account_holder  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers view own withdrawals' AND tablename = 'withdrawals') THEN
    CREATE POLICY "Sellers view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = seller_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers insert own withdrawals' AND tablename = 'withdrawals') THEN
    CREATE POLICY "Sellers insert own withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = seller_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage withdrawals' AND tablename = 'withdrawals') THEN
    CREATE POLICY "Admin manage withdrawals" ON public.withdrawals FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Also fix the RLS policies to use helper functions (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_seller_of_order(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND seller_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_order_customer(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND customer_id = _user_id)
$$;

DROP POLICY IF EXISTS "Customers see own orders" ON public.orders;
CREATE POLICY "Customers see own orders" ON public.orders FOR SELECT USING (
  auth.uid() = customer_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_seller_of_order(id, auth.uid())
);

DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_seller_of_order(id, auth.uid())
);

DROP POLICY IF EXISTS "Order items visibility" ON public.order_items;
CREATE POLICY "Order items visibility" ON public.order_items FOR SELECT USING (
  auth.uid() = seller_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_order_customer(order_id, auth.uid())
);

DROP POLICY IF EXISTS "Order items insert with order" ON public.order_items;
CREATE POLICY "Order items insert with order" ON public.order_items FOR INSERT
WITH CHECK (public.is_order_customer(order_id, auth.uid()));
