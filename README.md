# ABS Post Automation

Cloud-first Node.js automation for generating alphabetical English word cards, storing them in Supabase Storage, scheduling post sessions in hosted Postgres through Prisma, and publishing to your third-party social API.

## Stack

- Runtime: Node.js + TypeScript
- Database: hosted PostgreSQL
- ORM and schema: Prisma
- File storage: Supabase Storage
- Scheduling: GitHub Actions
- Email: SMTP provider such as Resend SMTP
- Canvas rendering: `canvas`

## Runtime Model

This project no longer depends on:

- local Docker
- local PostgreSQL
- an always-on worker process

Instead it runs as short-lived commands:

- `generate-next`
- `plan-due`
- `plan-session`
- `post-due`
- `send-summaries`
- `tick`

`tick` is the main scheduled command. It plans sessions, posts due items, and sends summary emails.

## Scripts

- `npm run prisma:generate`
- `npm run prisma:db:push`
- `npm run prisma:migrate:dev`
- `npm run prisma:migrate:deploy`
- `npm run generate:next`
- `npm run plan:due`
- `npm run plan:session -- morning 2026-04-10`
- `npm run post:due`
- `npm run send:summaries`
- `npm run tick`

## Environment

See [.env.example](/home/ilesanmi/Desktop/abs-post-automation/.env.example#L1).

The main groups are:

- Database: `DATABASE_URL`, `DIRECT_URL`
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_TO`
- Provider API: `POST_PROVIDER_ENDPOINT`, `POST_PROVIDER_TOKEN`, `POST_PROVIDER_VISIBILITY_TYPE`
- Scheduling: `APP_TIMEZONE`, session hours, interval, retry limits

## First-Time Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Point `DATABASE_URL` and `DIRECT_URL` to your hosted Postgres database.

4. Set your Supabase project URL, service role key, and storage bucket.

5. Push the schema:

```bash
npm run prisma:db:push
```

6. Add your word list into the `LexiconEntry` table.

7. Generate one canvas:

```bash
npm run generate:next
```

8. Plan a session manually:

```bash
npm run plan:session -- morning 2026-04-10
```

9. Process due posts:

```bash
npm run post:due
```

## GitHub Actions

The repo includes:

- [automation-tick.yml](/home/ilesanmi/Desktop/abs-post-automation/.github/workflows/automation-tick.yml)
- [generate-next-word.yml](/home/ilesanmi/Desktop/abs-post-automation/.github/workflows/generate-next-word.yml)

Use GitHub repository secrets for all real production values.
