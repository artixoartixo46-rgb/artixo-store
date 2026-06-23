-- Ensure all seller profile columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_description TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_slug TEXT;

-- Ensure profiles UPDATE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users update own profile' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Users update own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Ensure product-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop & recreate storage policies to ensure they're correct
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Product images public read v2' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Product images public read v2"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'product-images');
  END IF;

  -- INSERT (authenticated users can upload)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated upload product images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated upload product images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'product-images');
  END IF;

  -- UPDATE (owner can update)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update own images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated update own images"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'product-images');
  END IF;

  -- DELETE (owner can delete)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete own images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated delete own images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'product-images');
  END IF;
END $$;
