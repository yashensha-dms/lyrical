-- Create voice_memos table in Supabase
CREATE TABLE IF NOT EXISTS public.voice_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors on re-runs
DROP POLICY IF EXISTS "Users can view voice memos of their own projects" ON public.voice_memos;
DROP POLICY IF EXISTS "Users can insert voice memos of their own projects" ON public.voice_memos;
DROP POLICY IF EXISTS "Users can delete voice memos of their own projects" ON public.voice_memos;

-- Select policy: users can only read voice memos belonging to their own projects
CREATE POLICY "Users can view voice memos of their own projects"
  ON public.voice_memos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = voice_memos.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Insert policy: users can only insert voice memos belonging to their own projects
CREATE POLICY "Users can insert voice memos of their own projects"
  ON public.voice_memos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = voice_memos.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Delete policy: users can only delete voice memos belonging to their own projects
CREATE POLICY "Users can delete voice memos of their own projects"
  ON public.voice_memos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = voice_memos.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create audio storage bucket if not exists and set it to public
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true) ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist to prevent errors on re-runs
DROP POLICY IF EXISTS "Allow public read access to audio storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts to audio storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes to audio storage" ON storage.objects;

-- Enable storage policies for the 'audio' bucket
CREATE POLICY "Allow public read access to audio storage"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'audio');

CREATE POLICY "Allow authenticated inserts to audio storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Allow authenticated deletes to audio storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio');
