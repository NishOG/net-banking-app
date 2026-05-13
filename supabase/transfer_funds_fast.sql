-- Corrected Optimized Atomic Transfer Function
CREATE OR REPLACE FUNCTION transfer_funds_fast(
  p_sender_account TEXT,
  p_recipient_account TEXT,
  p_amount NUMERIC,
  p_remarks TEXT DEFAULT 'P2P Transfer'
) RETURNS JSON 
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Deduct from sender
  UPDATE accounts SET balance = balance - p_amount 
  WHERE account_number = p_sender_account;
  
  -- 2. Add to recipient
  UPDATE accounts SET balance = balance + p_amount 
  WHERE account_number = p_recipient_account;
  
  -- 3. Log transaction (Using the correct 'description' column)
  INSERT INTO transactions 
  (from_account, to_account, amount, type, description, created_at)
  VALUES (p_sender_account, p_recipient_account, p_amount, 
          'Transfer', p_remarks, NOW());
  
  RETURN json_build_object(
    'status', 'success',
    'message', 'Transfer complete in < 1 second'
  );
END;
$$ LANGUAGE plpgsql;
