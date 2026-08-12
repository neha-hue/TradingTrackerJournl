# TradingTrackerJournl

A trading journal built with Vite + React, backed by a small local Express + SQLite server (no cloud account required).

## Architecture

- `src/` - the React frontend (Vite dev server on port 5173).
- `server/` - an Express API (port 3001) backed by SQLite (`node:sqlite`, no native build step). Handles auth, data, and screenshot storage.
- The frontend talks to the backend at `/api/*` and `/uploads/*`; Vite proxies both to the Express server in dev (see `vite.config.ts`).

## Prerequisites

- Node.js 22.5+ (built-in `node:sqlite` support). Tested on Node 24.

## Setup

```bash
npm install
npm run db:migrate   # creates server/data/trading-journal.db and its tables
npm run dev           # starts the Vite dev server (5173) and the API server (3001) together
```

Open http://localhost:5173.

### Environment variables

`.env` (server, gitignored) - all optional, sensible defaults shown:

```
PORT=3001
SESSION_SECRET=<any random string>
DATABASE_PATH=server/data/trading-journal.db
UPLOAD_DIR=server/uploads
```

`.env.local` (frontend, gitignored) - optional single-owner auto sign-in, so no login screen is shown on this device. Leave unset to get the normal sign-up/sign-in screen instead:

```
VITE_AUTO_LOGIN_EMAIL=you@example.com
VITE_AUTO_LOGIN_PASSWORD="your-password"
```

On a brand-new database this account is created automatically on first run; on later runs it just signs in.

## Common commands

- `npm run dev` - frontend + backend together, for local development.
- `npm run dev:client` / `npm run dev:server` - run just one side.
- `npm run server` - run the API server alone with `tsx` (no watch mode).
- `npm run build` - type-checks and builds the frontend to `dist/` (frontend only).
- `npm run db:migrate` - (re-)applies `server/db/schema.sql`. Safe to run any time; it only creates tables that don't already exist.

## Backups

```bash
npm run backup                    # -> backups/2026-08-12_1458/  (database + screenshots)
npm run restore                   # lists available backups
npm run restore 2026-08-12_1458   # restores that one
```

`npm run backup` is safe to run while the app is running: the database is copied with
SQLite's `VACUUM INTO`, which writes a consistent snapshot instead of the possibly
half-written file a plain copy can produce. The 10 most recent backups are kept
(`KEEP=20 npm run backup` to keep more).

`npm run restore` needs the server stopped first - Windows will not let an open database
file be overwritten, and the script stops with an explanation rather than doing anything
half-way. It copies the current database and uploads to `backups/_before-restore-<stamp>/`
before overwriting, so a restore is itself undoable.

By default backups land in `backups/` on the same disk, which protects against accidental
deletion but not against that disk failing. Point `BACKUP_DIR` somewhere else - another
drive, or a synced folder - for real safety:

```bash
BACKUP_DIR=D:/journal-backups npm run backup
```

## Resetting the database

Delete the database file and re-migrate:

```bash
rm server/data/trading-journal.db
npm run db:migrate
```

Uploaded screenshots live under `server/uploads/` as plain files; delete their contents too if you want a full reset.

## Importing from the old Supabase project

`scripts/migrate-from-supabase.ts` is a one-off importer that copies accounts, strategies,
trades and screenshots out of the old Supabase project into the local database, downloading
each screenshot from Supabase Storage into `server/uploads/` so nothing depends on Supabase
afterwards. This has already been run; it is kept for reference and for re-importing into a
fresh database.

It is safe to re-run - rows keep their original UUIDs as local primary keys and every insert
is `INSERT OR IGNORE`, so it never duplicates or re-downloads. Credentials come from the
environment and are never written to disk. Stop the API server first so it isn't writing to
the database at the same time:

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
SUPABASE_EMAIL=<email> \
SUPABASE_PASSWORD=<password> \
LOCAL_EMAIL=<local account email> \
npx tsx scripts/migrate-from-supabase.ts
```

## Deployment note

`netlify.toml` only builds and hosts the static frontend. Since the app now depends on `server/` for data, deploying just the frontend (e.g. to Netlify) will show a "could not reach the local server" error unless the backend is also deployed and reachable at `/api` and `/uploads` from wherever the frontend is served. This project is set up for local use; hosting the backend is a separate step outside this repo's scope.
