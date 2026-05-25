-- Create graveyard table in Supabase
CREATE TABLE IF NOT EXISTS public.graveyard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  content TEXT NOT NULL,
  project_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.graveyard ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only view their own graveyard entries
CREATE POLICY "Users can view their own graveyard entries" 
  ON public.graveyard 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Insert policy: users can only create graveyard entries with their own user_id
CREATE POLICY "Users can create their own graveyard entries" 
  ON public.graveyard 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);
