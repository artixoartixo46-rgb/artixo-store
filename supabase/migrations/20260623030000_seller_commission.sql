-- ── Seller Commission & Wallet System ────────────────────────────────────────

-- Add wallet columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 8.00;

-- ── withdrawals table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gross_amount    NUMERIC(12,2) NOT NULL,   -- amount seller requested to withdraw
  commission      NUMERIC(12,2) NOT NULL,   -- ARTIXO commission already deducted (informational)
  net_amount      NUMERIC(12,2) NOT NULL,   -- what seller actually receives
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

-- Sellers can view and create their own withdrawals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers view own withdrawals' AND tablename = 'withdrawals') THEN
    CREATE POLICY "Sellers view own withdrawals"
      ON public.withdrawals FOR SELECT
      USING (auth.uid() = seller_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers insert own withdrawals' AND tablename = 'withdrawals') THEN
    CREATE POLICY "Sellers insert own withdrawals"
      ON public.withdrawals FOR INSERT
      WITH CHECK (auth.uid() = seller_id);
  END IF;
END $$;

-- Admins can do everything
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage withdrawals' AND tablename = 'withdrawals') THEN
    CREATE POLICY "Admin manage withdrawals"
      ON public.withdrawals FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
