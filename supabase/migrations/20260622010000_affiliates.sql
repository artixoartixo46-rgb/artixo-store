-- Affiliate & Referral System

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  status TEXT NOT NULL DEFAULT 'pending',
  total_clicks INT NOT NULL DEFAULT 0,
  total_conversions INT NOT NULL DEFAULT 0,
  total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  payout_method TEXT,
  payout_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;

-- Affiliates: users see their own row
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliates' AND policyname='Affiliates read own') THEN
    CREATE POLICY "Affiliates read own" ON affiliates FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliates' AND policyname='Affiliates insert own') THEN
    CREATE POLICY "Affiliates insert own" ON affiliates FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliates' AND policyname='Affiliates update own') THEN
    CREATE POLICY "Affiliates update own" ON affiliates FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_conversions' AND policyname='Affiliates read own conversions') THEN
    CREATE POLICY "Affiliates read own conversions" ON referral_conversions
      FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));
  END IF;
END $$;
