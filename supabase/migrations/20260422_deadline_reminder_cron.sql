-- Automatic Deadline Reminder Email System
-- Creates email_log table to track sent reminders and prevent duplicates
-- The send-deadline-reminder Edge Function will check this table before sending

-- Email log table to track sent reminders (prevent duplicates)
CREATE TABLE IF NOT EXISTS email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gameweek int NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('deadline_reminder', 'weekly_summary', 'season_end')),
  sent_at timestamptz DEFAULT now(),
  success boolean DEFAULT true,
  error_message text,
  UNIQUE(gameweek, email_type)
);

-- RLS: Allow authenticated users to read email log
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Email log visible to authenticated users"
  ON email_log FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Allow service role to insert email log entries
CREATE POLICY "Email log insert for service role"
  ON email_log FOR INSERT
  TO service_role
  USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_log_gameweek_type ON email_log(gameweek, email_type);

-- Manual testing queries:
-- SELECT * FROM email_log ORDER BY sent_at DESC;
-- DELETE FROM email_log WHERE gameweek = X; -- to reset for testing
