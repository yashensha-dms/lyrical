-- Create scrapbook_entries table in Supabase
CREATE TABLE IF NOT EXISTS public.scrapbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.scrapbook_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors on re-runs
DROP POLICY IF EXISTS "Users can view scrapbook entries of their own projects" ON public.scrapbook_entries;
DROP POLICY IF EXISTS "Users can insert scrapbook entries of their own projects" ON public.scrapbook_entries;
DROP POLICY IF EXISTS "Users can update scrapbook entries of their own projects" ON public.scrapbook_entries;

-- Select policy: users can view scrapbook entries belonging to their own projects
CREATE POLICY "Users can view scrapbook entries of their own projects"
  ON public.scrapbook_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scrapbook_entries.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Insert policy: users can create scrapbook entries belonging to their own projects
CREATE POLICY "Users can insert scrapbook entries of their own projects"
  ON public.scrapbook_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scrapbook_entries.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Update policy: users can update scrapbook entries belonging to their own projects
CREATE POLICY "Users can update scrapbook entries of their own projects"
  ON public.scrapbook_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scrapbook_entries.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scrapbook_entries.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create scrapbook storage bucket if not exists via SQL or dashboard instructions.
INSERT INTO storage.buckets (id, name, public) VALUES ('scrapbook', 'scrapbook', true) ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist to prevent errors on re-runs
DROP POLICY IF EXISTS "Allow public read access to scrapbook storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts to scrapbook storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to scrapbook storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes to scrapbook storage" ON storage.objects;

-- Enable storage policies for the 'scrapbook' bucket
CREATE POLICY "Allow public read access to scrapbook storage"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'scrapbook');

CREATE POLICY "Allow authenticated inserts to scrapbook storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'scrapbook');

CREATE POLICY "Allow authenticated updates to scrapbook storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'scrapbook')
  WITH CHECK (bucket_id = 'scrapbook');

CREATE POLICY "Allow authenticated deletes to scrapbook storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'scrapbook');

