-- Match the directory's bounded, deterministic pagination without indexing PII.
CREATE INDEX IF NOT EXISTS members_active_directory_idx ON public.members
  (organization_id, created_at DESC, id DESC) WHERE active = true;
CREATE INDEX IF NOT EXISTS visitors_active_directory_idx ON public.visitors
  (organization_id, created_at DESC, id DESC) WHERE active = true;
