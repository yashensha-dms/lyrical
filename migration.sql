-- Add status column (text, default 'Demo')
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Demo';

-- Add writers column (jsonb, default empty array)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS writers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add producers column (jsonb, default empty array)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS producers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add featured_artists column (jsonb, default empty array)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS featured_artists JSONB NOT NULL DEFAULT '[]'::jsonb;

-- The existing UPDATE policy "Users can update their own projects" covers all columns
-- for rows owned by the user. For completeness, we drop and recreate the policy to ensure
-- it's active and applied properly:
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;

CREATE POLICY "Users can update their own projects" 
  ON public.projects 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
