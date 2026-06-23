-- Add 3D model URL column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS model_url text;

-- Storage bucket for 3D models (.glb files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '3d-models',
  '3d-models',
  true,
  52428800,
  ARRAY['model/gltf-binary', 'application/octet-stream', 'model/gltf+json']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view 3d models' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can view 3d models"
      ON storage.objects FOR SELECT
      USING (bucket_id = '3d-models');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload 3d models' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload 3d models"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = '3d-models');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own 3d models' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own 3d models"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = '3d-models');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own 3d models' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own 3d models"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = '3d-models');
  END IF;
END $$;
