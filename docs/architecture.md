# Architecture Notes

## Current Design

The system is now command-driven and cloud-first:

- GitHub Actions triggers short-lived jobs
- Prisma manages hosted PostgreSQL access
- Supabase Storage holds generated PNG assets
- SMTP sends session summaries

## Command Flow

### `generate-next`

1. Claim the next pending word from the cursor.
2. Render a PNG canvas.
3. Upload the PNG to Supabase Storage.
4. Save metadata in Postgres.
5. Mark the word as rendered.

### `plan-due`

1. Check the current date in `APP_TIMEZONE`.
2. Determine which session windows are due.
3. Create post jobs for rendered items that have not yet been scheduled.

### `post-due`

1. Find post jobs whose scheduled time or retry time has arrived.
2. Download the stored PNG from Supabase Storage.
3. Send `multipart/form-data` to the provider API.
4. Persist attempts, retries, and final states.

### `send-summaries`

1. Find completed sessions with no summary email yet.
2. Build a text summary.
3. Send through SMTP.
4. Mark the session as emailed.

## Why This Is Lighter

This removes:

- local Postgres management
- Docker as a normal runtime dependency
- always-on background workers

It keeps:

- strict typing
- persistent retries
- session history
- cloud image storage
