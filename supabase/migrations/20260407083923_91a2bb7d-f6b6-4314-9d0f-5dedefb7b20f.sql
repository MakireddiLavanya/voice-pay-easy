
-- Add account locking columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS failed_auth_attempts integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS face_enrolled boolean NOT NULL DEFAULT false;

-- OTP codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'transaction',
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OTPs" ON public.otp_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OTPs" ON public.otp_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OTPs" ON public.otp_codes
  FOR UPDATE USING (auth.uid() = user_id);

-- Face references table
CREATE TABLE IF NOT EXISTS public.face_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_data text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.face_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own face data" ON public.face_references
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own face data" ON public.face_references
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own face data" ON public.face_references
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own face data" ON public.face_references
  FOR DELETE USING (auth.uid() = user_id);

-- Generate OTP function
CREATE OR REPLACE FUNCTION public.generate_otp(p_purpose text DEFAULT 'transaction')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_code text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Generate 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');

  -- Invalidate previous unused OTPs
  UPDATE otp_codes SET used = true 
  WHERE user_id = v_user_id AND purpose = p_purpose AND used = false;

  -- Store hashed OTP
  INSERT INTO otp_codes (user_id, code_hash, purpose, expires_at)
  VALUES (v_user_id, crypt(v_code, gen_salt('bf')), p_purpose, now() + interval '5 minutes');

  RETURN json_build_object('success', true, 'code', v_code);
END;
$$;

-- Verify OTP function
CREATE OR REPLACE FUNCTION public.verify_otp(p_code text, p_purpose text DEFAULT 'transaction')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_otp_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_otp_record
  FROM otp_codes
  WHERE user_id = auth.uid()
    AND purpose = p_purpose
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No valid OTP found or OTP expired');
  END IF;

  IF v_otp_record.code_hash = crypt(p_code, v_otp_record.code_hash) THEN
    UPDATE otp_codes SET used = true WHERE id = v_otp_record.id;
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid OTP');
  END IF;
END;
$$;

-- Check account lock status
CREATE OR REPLACE FUNCTION public.check_account_locked()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_locked_until timestamp with time zone;
  v_failed integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('locked', false);
  END IF;

  SELECT locked_until, failed_auth_attempts INTO v_locked_until, v_failed
  FROM profiles WHERE user_id = auth.uid();

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN json_build_object(
      'locked', true, 
      'until', v_locked_until,
      'failed_attempts', v_failed
    );
  END IF;

  -- Auto-unlock if time has passed
  IF v_locked_until IS NOT NULL AND v_locked_until <= now() THEN
    UPDATE profiles SET failed_auth_attempts = 0, locked_until = NULL
    WHERE user_id = auth.uid();
  END IF;

  RETURN json_build_object('locked', false, 'failed_attempts', COALESCE(v_failed, 0));
END;
$$;

-- Increment failed attempts
CREATE OR REPLACE FUNCTION public.increment_failed_attempts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempts integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('locked', false);
  END IF;

  UPDATE profiles 
  SET failed_auth_attempts = failed_auth_attempts + 1
  WHERE user_id = auth.uid()
  RETURNING failed_auth_attempts INTO v_attempts;

  -- Lock after 3 failures for 30 minutes
  IF v_attempts >= 3 THEN
    UPDATE profiles 
    SET locked_until = now() + interval '30 minutes'
    WHERE user_id = auth.uid();
    
    RETURN json_build_object('locked', true, 'attempts', v_attempts, 'lock_duration', '30 minutes');
  END IF;

  RETURN json_build_object('locked', false, 'attempts', v_attempts);
END;
$$;

-- Reset failed attempts on success
CREATE OR REPLACE FUNCTION public.reset_failed_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE profiles SET failed_auth_attempts = 0, locked_until = NULL
  WHERE user_id = auth.uid();
END;
$$;
