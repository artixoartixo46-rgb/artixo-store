
-- 1. Remove anonymous read on orders/order_items (sensitive PII exposure)
DROP POLICY IF EXISTS "backend_read_orders" ON public.orders;
DROP POLICY IF EXISTS "backend_read_order_items" ON public.order_items;

-- 2. Remove the privilege-escalation update policy on orders
DROP POLICY IF EXISTS "admins_update_orders" ON public.orders;

-- 3. Add pending_seller role to enum so the seller-application flow works
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pending_seller';
