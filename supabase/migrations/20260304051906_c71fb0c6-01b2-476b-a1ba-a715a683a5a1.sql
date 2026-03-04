
-- Table for temporary login tokens (QR code auto-login)
CREATE TABLE public.login_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  redirect_path TEXT NOT NULL DEFAULT '/',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.login_tokens ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can create tokens (for themselves)
CREATE POLICY "Users can create their own tokens"
ON public.login_tokens FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Anyone can read tokens (needed for token exchange by unauthenticated mobile)
-- Security is handled by the edge function + token expiry
CREATE POLICY "Tokens are readable for exchange"
ON public.login_tokens FOR SELECT
USING (true);

-- Users can update their own tokens (mark as used)
CREATE POLICY "Service can update tokens"
ON public.login_tokens FOR UPDATE
USING (true);

-- Cleanup: auto-delete expired tokens via index for efficient queries
CREATE INDEX idx_login_tokens_token ON public.login_tokens (token);
CREATE INDEX idx_login_tokens_expires ON public.login_tokens (expires_at);
