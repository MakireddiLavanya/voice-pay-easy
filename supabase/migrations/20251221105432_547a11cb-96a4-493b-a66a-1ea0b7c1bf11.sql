-- 1. Add explicit DELETE protection on transactions (immutability for audit trail)
CREATE POLICY "No transaction deletion" 
ON public.transactions 
FOR DELETE 
USING (false);

-- 2. Add DELETE policy on profiles for GDPR compliance
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Create atomic transfer function to prevent race conditions
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sender_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  
  -- Lock sender wallet and check balance atomically
  SELECT balance INTO v_sender_balance
  FROM wallets
  WHERE user_id = p_sender_id
  FOR UPDATE;
  
  IF v_sender_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  
  IF v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient funds');
  END IF;
  
  -- Verify receiver wallet exists and lock it
  PERFORM 1 FROM wallets WHERE user_id = p_receiver_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Receiver wallet not found');
  END IF;
  
  -- Atomic balance updates using increment/decrement
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_sender_id;
  
  UPDATE wallets
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_receiver_id;
  
  -- Create transaction record
  INSERT INTO transactions (sender_id, receiver_id, amount, description, status)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_description, 'completed')
  RETURNING id INTO v_transaction_id;
  
  RETURN json_build_object(
    'success', true, 
    'transaction_id', v_transaction_id,
    'amount', p_amount
  );
END;
$$;

-- Add CHECK constraint to ensure balance never goes negative
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);