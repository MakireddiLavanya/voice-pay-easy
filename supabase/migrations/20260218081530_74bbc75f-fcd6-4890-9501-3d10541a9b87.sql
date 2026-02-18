
-- Recreate profiles_public view to include mobile_number
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT user_id, full_name, email, mobile_number
  FROM public.profiles;
