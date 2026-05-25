-- Create phrases table in Supabase
CREATE TABLE IF NOT EXISTS public.phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.phrases ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only view their own phrases
CREATE POLICY "Users can view their own phrases" 
  ON public.phrases 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Insert policy: users can only create phrases with their own user_id
CREATE POLICY "Users can create their own phrases" 
  ON public.phrases 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can only delete their own phrases
CREATE POLICY "Users can delete their own phrases" 
  ON public.phrases 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);
