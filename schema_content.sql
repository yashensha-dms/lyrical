-- Migration: Replace binary yjs_state with plain-text content column
-- Run this in Supabase SQL Editor

-- 1. Add content column if it doesn't exist
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';

-- 2. Drop the binary yjs_state column (no longer needed)
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS yjs_state;
