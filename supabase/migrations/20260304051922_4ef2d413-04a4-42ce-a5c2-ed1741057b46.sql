
-- Fix UPDATE policy to be more restrictive
DROP POLICY "Service can update tokens" ON public.login_tokens;
CREATE POLICY "Users can update their own tokens"
ON public.login_tokens FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
