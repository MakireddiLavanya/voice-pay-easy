
-- Create a public view for recipient search that excludes sensitive fields
CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT user_id, full_name, email
  FROM public.profiles;

-- Allow all authenticated users to SELECT from profiles (needed for the view)
-- But we'll use the view in app code to hide sensitive columns
CREATE POLICY "Authenticated users can search profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Drop the old restrictive self-only SELECT policy
DROP POLICY "Users can view own profile" ON public.profiles;
