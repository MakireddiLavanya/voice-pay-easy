
-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Function to hash and store a transaction PIN
CREATE OR REPLACE FUNCTION public.set_transaction_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF length(p_pin) != 4 OR p_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  UPDATE profiles
  SET transaction_pin = crypt(p_pin, gen_salt('bf'))
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Function to verify a transaction PIN
CREATE OR REPLACE FUNCTION public.verify_transaction_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  SELECT transaction_pin INTO v_stored_hash
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_stored_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No PIN set');
  END IF;

  IF v_stored_hash = crypt(p_pin, v_stored_hash) THEN
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Incorrect PIN');
  END IF;
END;
$$;

-- Reset existing plaintext PINs (users must re-set them)
UPDATE profiles SET transaction_pin = NULL WHERE transaction_pin IS NOT NULL;

-- Enhanced transfer_funds with auth check, rate limit, validation
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance numeric;
  v_transaction_id uuid;
  v_recent_count integer;
BEGIN
  -- Auth check: caller must be the sender
  IF auth.uid() IS NULL OR auth.uid() != p_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- No self-transfers
  IF p_sender_id = p_receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Amount validation
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_amount > 100000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum limit of ₹1,00,000');
  END IF;

  IF p_amount != round(p_amount, 2) THEN
    RETURN json_build_object('success', false, 'error', 'Amount can have at most 2 decimal places');
  END IF;

  -- Rate limit: max 10 transfers per minute
  SELECT count(*) INTO v_recent_count
  FROM transactions
  WHERE sender_id = p_sender_id
    AND created_at > now() - interval '1 minute';

  IF v_recent_count >= 10 THEN
    RETURN json_build_object('success', false, 'error', 'Too many transfers. Please wait a moment.');
  END IF;

  -- Lock sender wallet and check balance
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

  -- Lock receiver wallet
  PERFORM 1 FROM wallets WHERE user_id = p_receiver_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Receiver wallet not found');
  END IF;

  -- Atomic balance updates
  UPDATE wallets SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_sender_id;
  UPDATE wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = p_receiver_id;

  -- Create transaction record
  INSERT INTO transactions (sender_id, receiver_id, amount, description, status)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_description, 'completed')
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object('success', true, 'transaction_id', v_transaction_id, 'amount', p_amount);
END;
$$;
