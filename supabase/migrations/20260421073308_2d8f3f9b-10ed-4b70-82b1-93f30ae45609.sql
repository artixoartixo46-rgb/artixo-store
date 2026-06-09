
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Restrict storage listing to owner only (individual files still public via direct URL)
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
CREATE POLICY "Product images owner list"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images' AND (auth.uid() = owner OR auth.role() = 'anon'));
