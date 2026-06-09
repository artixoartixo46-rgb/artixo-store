-- Auto-approve products: change default and approve all existing pending products
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'approved'::product_status;
UPDATE public.products SET status = 'approved' WHERE status = 'pending';