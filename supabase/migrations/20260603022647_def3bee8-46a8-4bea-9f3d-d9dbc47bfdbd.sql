ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url text;

UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-beauty.jpg' WHERE slug = 'beauty-health';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-books.jpg' WHERE slug = 'books-stationery';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-electronics.jpg' WHERE slug = 'electronics';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-fashion.jpg' WHERE slug = 'fashion';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-groceries.jpg' WHERE slug = 'groceries';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-home.jpg' WHERE slug = 'home-living';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-sports.jpg' WHERE slug = 'sports-outdoor';
UPDATE public.categories SET image_url = 'https://jxqvonnunztkyyifazxd.supabase.co/storage/v1/object/public/product-images/categories%2Fcategory-toys.jpg' WHERE slug = 'toys-kids';
