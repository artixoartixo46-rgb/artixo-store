-- Allow admins to insert products without needing seller role
DROP POLICY IF EXISTS "Sellers insert own products" ON public.products;

CREATE POLICY "Sellers or admins insert products"
ON public.products
FOR INSERT
WITH CHECK (
  (auth.uid() = seller_id AND has_role(auth.uid(), 'seller'::app_role))
  OR has_role(auth.uid(), 'admin'::app_role)
);