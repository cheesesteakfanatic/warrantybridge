# WarrantyBridge

Professional warranty communication between home builders and homebuyers.

New-home warranties only work when there's a clear, written record. WarrantyBridge gives builders and buyers a shared workspace per home: documented issues with photos, a live repair-status timeline (acknowledged → scheduled → dispatched → in progress → resolved), and messaging with read receipts — so both sides always know where things stand.

## Features

- **Accounts & roles** — sign up as a homebuyer or builder (Supabase Auth, email + password)
- **Homes (households)** — either party creates a home and invites the other with a one-time code or link
- **Warranty issues** — title, description, category, priority, photo uploads
- **Repair status tracking** — 7-stage status flow with a full audit timeline of who changed what, when
- **Messaging** — per-issue threads with text + image attachments
- **Read receipts** — ✓ Sent / ✓✓ Read indicators
- **Live updates** — Supabase Realtime with polling fallback
- **Security** — every table is protected by Postgres Row Level Security; only household members can see a home's data

## Stack

- React 18 + Vite
- Supabase (Postgres, Auth, Storage, Realtime) — schema in `supabase/schema.sql`
- Netlify (static hosting)

## Local development

```bash
npm install
npm run dev
```

Configuration lives in `src/lib/supabase.js` (defaults provided) or override with env vars:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The anon key is public by design — all authorization is enforced server-side by Row Level Security.

## Deploy

```bash
npm run build   # outputs to dist/
```

Deploy `dist/` to any static host. `public/_redirects` handles SPA routing on Netlify.
