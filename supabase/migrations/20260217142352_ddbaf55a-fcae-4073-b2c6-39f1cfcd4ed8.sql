
-- Add auth_mode and transaction_pin to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS auth_mode text NOT NULL DEFAULT 'pin',
ADD COLUMN IF NOT EXISTS transaction_pin text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voice_tolerance numeric NOT NULL DEFAULT 0.85;

-- Create fraud_alerts table
CREATE TABLE public.fraud_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  transaction_id uuid,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fraud alerts"
ON public.fraud_alerts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert fraud alerts"
ON public.fraud_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fraud alerts"
ON public.fraud_alerts FOR UPDATE
USING (auth.uid() = user_id);

-- Create authentication_logs table
CREATE TABLE public.authentication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  auth_method text NOT NULL,
  success boolean NOT NULL,
  ip_address text,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.authentication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auth logs"
ON public.authentication_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auth logs"
ON public.authentication_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_fraud_alerts_user_id ON public.fraud_alerts(user_id);
CREATE INDEX idx_fraud_alerts_created_at ON public.fraud_alerts(created_at DESC);
CREATE INDEX idx_auth_logs_user_id ON public.authentication_logs(user_id);
CREATE INDEX idx_auth_logs_created_at ON public.authentication_logs(created_at DESC);
