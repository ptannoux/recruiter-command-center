# Recruiter Command Center — live app starter

This is the production-oriented successor to the single-file HTML prototype. It uses **Next.js 16 + Supabase/Postgres**, has private authentication and Row Level Security, imports the 39 researched recruiter profiles, persists workflow edits, and has a server-side outreach-draft endpoint. Gmail and LinkedIn are intentionally separated as integration layers so the core CRM stays stable.

## What is working in this starter

- Private sign-up/sign-in
- Recruiter database with fit, priority, research, notes, sources and workflow status
- One-time import of the 39 profiles from the mockup
- Persistent positioning / target-role settings
- Search and filters
- Recruiter detail panel
- Persistent status, last-contact, next-step and notes
- LinkedIn / email draft generation
  - deterministic template without any paid API
  - OpenAI Responses API if `OPENAI_API_KEY` is configured
- Human approval flag; nothing is automatically sent
- Database tables already reserved for interactions, companies and opportunities

## 1. Create Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/migrations/001_initial.sql` in full.
4. In Project Settings → API / Connect, copy:
   - Project URL
   - Publishable key
5. For a private personal app, you can disable new-user signups after your own account exists.

## 2. Configure the app

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional AI drafting:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-terra
```

Never expose Supabase secret/service keys or your OpenAI key in browser-prefixed environment variables.

## 3. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, create your account, then go to **Import starter data** and import the 39 profiles.

## 4. Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import `ptannoux/recruiter-command-center`.
2. Keep the detected **Next.js** framework preset and the repository root as the root directory.
3. Add these environment variables to **Production**, **Preview**, and **Development**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `OPENAI_API_KEY` (optional)
   - `OPENAI_MODEL` (optional; defaults to `gpt-5.6-terra`)
4. For Production, add `NEXT_PUBLIC_SITE_URL=https://YOUR-PRODUCTION-DOMAIN`.
   Vercel automatically supplies `NEXT_PUBLIC_VERCEL_URL` for preview deployments.
5. Deploy. Vercel will install dependencies and run `npm run build` using the committed lockfile.

### Required Supabase Auth URL configuration

In **Supabase → Authentication → URL Configuration**:

- Set **Site URL** to the production Vercel/custom-domain URL.
- Add `http://localhost:3000/**` to **Redirect URLs**.
- Add the exact production callback, for example `https://YOUR-PRODUCTION-DOMAIN/auth/confirm`.
- If you want sign-up links to work on Vercel previews, add `https://*-YOUR-VERCEL-ACCOUNT-SLUG.vercel.app/**`.

The app accepts both PKCE `code` callbacks and `token_hash` confirmation links at `/auth/confirm`.
If you customize Supabase's **Confirm signup** email template to use a token hash, point it to:

```html
{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

After creating your own account, disable new-user sign-ups in Supabase if this remains a private, single-user application.

## Deployment verification

Before merging future changes, run:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

After the first Vercel deployment:

1. Create and confirm your account.
2. Sign in and open **Import starter data**.
3. Import the 39 recruiter profiles.
4. Edit one recruiter status and reload the page to confirm persistence.
5. Generate a LinkedIn draft first without `OPENAI_API_KEY` to test the deterministic fallback.
6. If using OpenAI, add the key only in Vercel and generate a second draft.

## Phase 2: Gmail

Do Gmail as an OAuth integration, not by storing a mailbox password. Recommended workflow:

`approved app draft → create Gmail draft → user reviews → user sends`

Add tables/tokens only server-side. Encrypt refresh tokens at rest. Request the smallest Google scopes required. Later, sync message/thread IDs into `interactions` so the app can calculate last contact and detect replies.

## LinkedIn design

Do **not** make the core product depend on unofficial LinkedIn scraping or automated DMs. Use:

1. LinkedIn profile URLs already stored on recruiters.
2. Periodic official LinkedIn Connections CSV import for your own network.
3. `Copy message + Open LinkedIn` as the safe initial workflow.
4. Add an official LinkedIn API integration only if the required permissions are approved for the use case.

## Suggested next build order

1. Gmail OAuth + Create Draft
2. CSV importer for your full LinkedIn Connections export
3. `interactions` timeline + Gmail reply sync
4. Target Companies screen
5. Opportunities pipeline
6. “Today’s Actions” home screen
7. Scheduled research refresh and source freshness alerts

## Security notes

Every user-owned table has RLS and an owner policy. The browser uses only a Supabase publishable key. Secret keys stay server-side. Before broader use, review Supabase Security Advisor, rate limits, backup policy and OAuth-token encryption.
