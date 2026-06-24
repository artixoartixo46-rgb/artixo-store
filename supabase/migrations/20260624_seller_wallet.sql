-- ============================================================
-- ARTIXO Seller Wallet System — Hybrid (Deposit + Invoice)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Seller wallet table
CREATE TABLE IF NOT EXISTS seller_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'deposit' CHECK (tier IN ('deposit', 'invoice')),
  tier_upgraded_at TIMESTAMPTZ,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_id)
);

-- 2. Wallet transactions log
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'commission', 'refund', 'adjustment')),
  amount NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add wallet_tier to profiles for quick lookup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_tier TEXT DEFAULT 'deposit';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS months_active INTEGER DEFAULT 0;

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_updated_at ON seller_wallets;
CREATE TRIGGER wallet_updated_at
  BEFORE UPDATE ON seller_wallets
  FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();

-- 5. Auto-create wallet when seller is created/role changed
CREATE OR REPLACE FUNCTION create_seller_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'seller' THEN
    INSERT INTO seller_wallets (seller_id) VALUES (NEW.id)
    ON CONFLICT (seller_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_seller_created ON profiles;
CREATE TRIGGER on_seller_created
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_seller_wallet();

-- 6. Create wallets for EXISTING sellers
INSERT INTO seller_wallets (seller_id)
SELECT id FROM profiles WHERE role = 'seller'
ON CONFLICT (seller_id) DO NOTHING;

-- 7. RLS
ALTER TABLE seller_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller_read_own_wallet" ON seller_wallets
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "seller_read_own_transactions" ON wallet_transactions
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "admin_wallet_all" ON seller_wallets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_transactions_all" ON wallet_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
