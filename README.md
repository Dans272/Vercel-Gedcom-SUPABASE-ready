<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Eternal — Family Archive Platform

A Vite + React 19 + TypeScript app backed by **Supabase** (Auth, Postgres, Storage).

---

## Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) project (free tier works)

## 1. Supabase Setup

1. Create a new Supabase project at <https://app.supabase.com>.
2. Open the **SQL Editor** and paste the contents of [`supabase/schema.sql`](supabase/schema.sql), then click **Run**. This creates all tables, RLS policies, storage buckets, and storage policies in one go.
3. Copy your **Project URL** and **anon public** key from **Settings → API**.
4. *(Optional)* Disable email confirmation under **Authentication → Providers → Email** for faster local dev.

## 2. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local from the example and fill in your keys
cp .env.example .env.local
# Edit .env.local:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key
#   VITE_GEMINI_API_KEY=your-gemini-key   (optional — AI features disabled if absent)

# 3. Start the dev server
npm run dev
```

The app runs at <http://localhost:3000>.

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_GEMINI_API_KEY`).
4. Deploy — Vercel auto-detects Vite.

## Architecture

| Layer | Tech |
|---|---|
| Auth | Supabase Auth (email + password) |
| Database | Supabase Postgres with RLS |
| File storage | Supabase Storage (`profile-media`, `circle-media` buckets) |
| Frontend | React 19, Vite, Tailwind (via CDN), Lucide icons |
| AI features | Google Gemini (`@google/genai`) |

### Key Files

| File | Purpose |
|---|---|
| `src/lib/supabaseClient.ts` | Supabase client singleton |
| `src/lib/supabaseDb.ts` | All Postgres CRUD with row ↔ type mappers |
| `src/lib/migrateLegacy.ts` | One-shot localStorage → Supabase migration |
| `src/services/storage.ts` | Upload helpers for both Storage buckets |
| `hooks/useSession.ts` | Auth state via `onAuthStateChange` |
| `hooks/useArchiveStore.ts` | Load from Supabase, debounced persist on change |
| `supabase/schema.sql` | DDL: tables, RLS policies, buckets, storage policies |

### Legacy Migration

On first login after enabling Supabase, any data in localStorage is automatically imported into Supabase (profiles, trees, posts, settings, and all media). The migration is **idempotent** — if the user already has rows in `app_profiles`, it skips the import and just clears the old localStorage keys.

## Original AI Studio Link

<https://ai.studio/apps/drive/1BqDOhtOV418obPtHW_x0fNAkecJR1_wE>
