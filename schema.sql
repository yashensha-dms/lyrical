-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only read their own projects
CREATE POLICY "Users can view their own projects" 
  ON public.projects 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Insert policy: users can only create projects with their own user_id
CREATE POLICY "Users can create their own projects" 
  ON public.projects 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Update policy: users can only update their own projects
CREATE POLICY "Users can update their own projects" 
  ON public.projects 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can only delete their own projects
CREATE POLICY "Users can delete their own projects" 
  ON public.projects 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);
