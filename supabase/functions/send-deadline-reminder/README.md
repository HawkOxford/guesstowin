# Deadline Reminder Email - Automated Cron Setup

This Edge Function sends automatic deadline reminder emails 24 hours before the first kickoff of each gameweek.

## How It Works

1. **Cron Schedule:** Function runs every hour (configured in Supabase Dashboard)
2. **Time Check:** Checks if first kickoff is within 24-25 hours (1-hour window)
3. **Duplicate Prevention:** Checks `email_log` table to ensure reminder not already sent
4. **Email Send:** If both checks pass, sends emails to all 10 players via Resend API
5. **Logging:** Records send in `email_log` table

## Setup Instructions

### 1. Run Database Migration

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/20260422_deadline_reminder_cron.sql

-- Creates email_log table with RLS policies
```

### 2. Set Resend API Key

```bash
# In terminal with SUPABASE_ACCESS_TOKEN set
supabase secrets set RESEND_API_KEY=re_your_api_key_here
```

### 3. Deploy Edge Function

```bash
supabase functions deploy send-deadline-reminder
```

### 4. Set Up Cron Schedule in Supabase Dashboard

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Click "Create a new cron job"
3. **Schedule:** `0 * * * *` (every hour on the hour)
4. **Command:**
   ```sql
   SELECT
     net.http_post(
       url := '<SUPABASE_URL>/functions/v1/send-deadline-reminder',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
       body := '{}'::jsonb
     );
   ```
5. Replace `<SUPABASE_URL>` with your project URL
6. Replace `<SERVICE_ROLE_KEY>` with your Supabase service role key
7. Save and enable

**Option B: Using pg_cron SQL (Alternative)**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job
SELECT cron.schedule(
  'deadline-reminder-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iufbdwsmbwrtcqzkvyey.supabase.co/functions/v1/send-deadline-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY_HERE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify cron job was created
SELECT * FROM cron.job;
```

## Testing

### Manual Test (triggers immediately regardless of schedule)

```bash
curl -X POST https://iufbdwsmbwrtcqzkvyey.supabase.co/functions/v1/send-deadline-reminder \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Check Email Log

```sql
SELECT * FROM email_log ORDER BY sent_at DESC;
```

### Clear Email Log (for testing)

```sql
-- Delete specific gameweek to re-test
DELETE FROM email_log WHERE gameweek = 29;
```

## Response Codes

**Success (email sent):**
```json
{
  "success": true,
  "gameweek": 29,
  "fixtures_count": 10,
  "emails_sent": 10,
  "emails_total": 10,
  "results": [...]
}
```

**Skipped (outside 24-hour window):**
```json
{
  "success": false,
  "skipped": true,
  "reason": "Outside 24-hour reminder window",
  "hours_until_kickoff": "48.25",
  "gameweek": 29
}
```

**Skipped (already sent):**
```json
{
  "success": false,
  "skipped": true,
  "reason": "Reminder already sent for this gameweek",
  "gameweek": 29
}
```

## Troubleshooting

**Emails not sending:**
1. Check Resend API key is set: `supabase secrets list`
2. Verify football API key: `supabase secrets list`
3. Check email_log for errors: `SELECT * FROM email_log WHERE success = false;`
4. Test Edge Function manually with curl command above

**Cron not running:**
1. Check cron job exists: `SELECT * FROM cron.job;`
2. Check cron job history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
3. Verify service role key in cron command is correct

**Duplicate emails:**
- Email_log table prevents this - check for errors in logs if duplicates occur

## Maintenance

**To disable:**
```sql
SELECT cron.unschedule('deadline-reminder-hourly');
```

**To re-enable:**
Re-run the `cron.schedule()` command above.

**To change schedule:**
```sql
-- Unschedule old job
SELECT cron.unschedule('deadline-reminder-hourly');

-- Create new schedule (e.g., every 30 minutes)
SELECT cron.schedule('deadline-reminder-hourly', '*/30 * * * *', ...);
```
