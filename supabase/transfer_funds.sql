CREATE OR REPLACE FUNCTION transfer_funds(
  p_sender_account TEXT,
  p_recipient_account TEXT,
  p_amount NUMERIC,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSON 
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
  v_recipient_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_sender_id FROM accounts 
  WHERE account_number = p_sender_account;
  
  SELECT id INTO v_recipient_id FROM accounts 
  WHERE account_number = p_recipient_account;
  
  -- Atomic update
  UPDATE accounts SET balance = balance - p_amount 
  WHERE id = v_sender_id;
  
  UPDATE accounts SET balance = balance + p_amount 
  WHERE id = v_recipient_id;
  
  -- Single transaction record
  INSERT INTO transactions 
  (from_account, to_account, amount, type, description, created_at)
  VALUES (p_sender_account, p_recipient_account, p_amount, 
          'Transfer', p_remarks, NOW());
  
  RETURN json_build_object('status', 'success', 'message', 'Transfer complete');
END;
$$ LANGUAGE plpgsql;
