-- ============================================================
-- ARTIXO STORE — One-time migration for djmrevzcetdpjzbggavj
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS everywhere
-- ============================================================

-- ── 1. Add missing columns to profiles ──────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_verified  BOOLEAN DEFAULT FALSE;

-- ── 2. verification_requests ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name  TEXT NOT NULL,
  business_type  TEXT NOT NULL,
  phone          TEXT,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  admin_notes    TEXT,
  reviewed_by    UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (seller_id)
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verification_requests' AND policyname = 'Sellers can manage own request'
  ) THEN
    CREATE POLICY "Sellers can manage own request"
      ON public.verification_requests
      FOR ALL USING (auth.uid() = seller_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verification_requests' AND policyname = 'Admins can view all requests'
  ) THEN
    CREATE POLICY "Admins can view all requests"
      ON public.verification_requests
      FOR SELECT USING (true);
  END IF;
END $$;

-- ── 3. seller_follows ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, seller_id)
);

ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'seller_follows' AND policyname = 'Users can manage own follows'
  ) THEN
    CREATE POLICY "Users can manage own follows"
      ON public.seller_follows
      FOR ALL USING (auth.uid() = follower_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'seller_follows' AND policyname = 'Anyone can read follows'
  ) THEN
    CREATE POLICY "Anyone can read follows"
      ON public.seller_follows
      FOR SELECT USING (true);
  END IF;
END $$;

-- ── 4. product_questions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_questions' AND policyname = 'Anyone can read questions'
  ) THEN
    CREATE POLICY "Anyone can read questions"
      ON public.product_questions
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_questions' AND policyname = 'Auth users can ask questions'
  ) THEN
    CREATE POLICY "Auth users can ask questions"
      ON public.product_questions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 5. product_answers ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES public.product_questions(id) ON DELETE CASCADE,
  seller_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer       TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (question_id)
);

ALTER TABLE public.product_answers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_answers' AND policyname = 'Anyone can read answers'
  ) THEN
    CREATE POLICY "Anyone can read answers"
      ON public.product_answers
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_answers' AND policyname = 'Sellers can manage answers'
  ) THEN
    CREATE POLICY "Sellers can manage answers"
      ON public.product_answers
      FOR ALL USING (auth.uid() = seller_id);
  END IF;
END $$;

-- ── 6. reviews (product ratings) — create if not yet exists ─
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can read reviews'
  ) THEN
    CREATE POLICY "Anyone can read reviews"
      ON public.reviews FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can manage own reviews'
  ) THEN
    CREATE POLICY "Users can manage own reviews"
      ON public.reviews FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 7. Reload PostgREST schema cache ────────────────────────
NOTIFY pgrst, 'reload schema';
