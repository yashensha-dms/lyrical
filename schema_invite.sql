-- Create project_collaborators join table
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Select policy: users can see who is collaborating on projects they own or participate in
CREATE POLICY "Users can view collaborators of their projects" 
  ON public.project_collaborators 
  FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    OR 
    auth.uid() IN (SELECT user_id FROM public.projects WHERE id = project_id)
  );

-- Insert policy: users can add themselves as collaborators
CREATE POLICY "Users can add themselves as collaborators" 
  ON public.project_collaborators 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can leave collaboration or owners can remove collaborators
CREATE POLICY "Users can delete collaborations" 
  ON public.project_collaborators 
  FOR DELETE 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    OR 
    auth.uid() IN (SELECT user_id FROM public.projects WHERE id = project_id)
  );
