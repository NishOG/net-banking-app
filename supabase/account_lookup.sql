-- Secure account lookup function
-- This allows any authenticated user to verify an account number exists
-- and get necessary info without exposing sensitive data like balance.

CREATE OR REPLACE FUNCTION get_account_by_number(p_account_number TEXT)
RETURNS TABLE(nickname TEXT, account_type TEXT, account_number TEXT, user_id UUID) 
SECURITY DEFINER -- Bypasses RLS to allow lookup
AS $$
BEGIN
  RETURN QUERY 
  SELECT a.nickname, a.account_type, a.account_number, a.user_id
  FROM accounts a 
  WHERE a.account_number = p_account_number;
END;
$$ LANGUAGE plpgsql;
