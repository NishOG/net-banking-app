-- Create payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account TEXT REFERENCES accounts(account_number),
  amount DECIMAL(15, 2),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- Policies for payment_links
-- 1. Users can view links they created (sent from their accounts)
CREATE POLICY "Users can view their own payment links"
  ON payment_links FOR SELECT
  USING (
    sender_account IN (
      SELECT account_number FROM accounts WHERE user_id = auth.uid()
    )
  );

-- 2. Users can create links from their own accounts
CREATE POLICY "Users can create their own payment links"
  ON payment_links FOR INSERT
  WITH CHECK (
    sender_account IN (
      SELECT account_number FROM accounts WHERE user_id = auth.uid()
    )
  );

-- 3. Public access to view a specific link (for the payment portal)
CREATE POLICY "Public can view payment links by ID"
  ON payment_links FOR SELECT
  USING (true);

-- 4. Public access to update status (for completing payment)
CREATE POLICY "Public can update link status"
  ON payment_links FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Ensure Realtime can see old values for status transition checks
ALTER TABLE payment_links REPLICA IDENTITY FULL;
