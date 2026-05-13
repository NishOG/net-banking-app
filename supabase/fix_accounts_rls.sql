-- SQL to allow public account lookups
-- WARNING: This policy allows any user to see the balances of all other users.
-- This is being applied as requested to fix the P2P transfer lookup issue.

DROP POLICY IF EXISTS "Users can read all accounts" ON accounts;
CREATE POLICY "Users can read all accounts"
ON accounts FOR SELECT USING (true);
