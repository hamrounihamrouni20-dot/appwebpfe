-- Safe migration: ensure ticket_notes has required columns
-- Adds columns if they do not already exist. Does not drop data.

ALTER TABLE IF EXISTS public.ticket_notes
  ADD COLUMN IF NOT EXISTS ticket_id uuid;

ALTER TABLE IF EXISTS public.ticket_notes
  ADD COLUMN IF NOT EXISTS author_id uuid;

ALTER TABLE IF EXISTS public.ticket_notes
  ADD COLUMN IF NOT EXISTS content text;

ALTER TABLE IF EXISTS public.ticket_notes
  ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

ALTER TABLE IF EXISTS public.ticket_notes
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Optionally add an index for ticket lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'ticket_notes' AND indexname = 'idx_ticket_notes_ticket_id'
  ) THEN
    CREATE INDEX idx_ticket_notes_ticket_id ON public.ticket_notes(ticket_id);
  END IF;
END$$;
