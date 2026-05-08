# FRC 2928 Scouting App

A competition scouting app for FRC Team 2928 built with React, TypeScript, Vite, and Convex.

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.12.0
- A [Convex](https://convex.dev) account (free)

---

## First-Time Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Connect to Convex

```bash
npx convex dev
```

On first run this will prompt you to log in to Convex and will create (or link) a deployment. It will automatically create a `.env.local` file with your deployment URL.

### 3. Set environment variables

After `npx convex dev` creates `.env.local`, confirm it contains:

```
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_DEPLOYMENT=dev:<your-deployment>
VITE_CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

You also need a TBA (The Blue Alliance) API key set in the Convex dashboard under **Settings → Environment Variables**:

```
TBA_API_KEY=<your key from thebluealliance.com/account>
```

---

## Running Locally

You need **two terminals** running simultaneously:

**Terminal 1 — Convex backend (keeps schema/functions in sync):**
```bash
npm run convex:dev
```

**Terminal 2 — Vite frontend:**
```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## Common Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server (frontend only) |
| `npm run convex:dev` | Start Convex dev watcher (auto-pushes backend changes) |
| `npm run build` | Build the frontend for production |
| `npm run convex:deploy` | Deploy Convex functions to production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

---

## Making Changes

### Frontend changes (React/TypeScript)
Edit files in `src/`. Vite hot-reloads automatically — no restart needed.

### Backend changes (Convex)
Edit files in `convex/`. The `npm run convex:dev` watcher detects changes and pushes them automatically. Watch its terminal output for any type errors or deployment failures.

### Schema changes
Edit `convex/schema.ts`. Convex dev will apply the change automatically. If you add a required field to an existing table you may need to backfill existing rows — see [Convex migrations docs](https://docs.convex.dev/database/migrations).

---

## Deploying

The app deploys to **Vercel** (frontend) + **Convex** (backend) together.

Vercel is configured to run `npx convex deploy` as part of its build command (`vercel.json`), so a single Vercel deploy handles both.

To deploy manually:
```bash
npm run convex:deploy   # push Convex functions to production
npm run build           # build the frontend
```

Or push to the `main` branch on GitHub if Vercel auto-deploy is connected.

---

## Project Structure

```
convex/          Convex backend — queries, mutations, actions, schema
  actions/       Node.js actions (TBA sync, Statbotics, scheduler, mock event)
  schema.ts      Database schema (all tables)
src/
  components/    Shared UI components (charts, layout, modals)
  config/        Default scouting field config (defaultScoutingConfig.ts)
  hooks/         Custom React hooks
  lib/           Shared types and utilities
  pages/         Top-level page components
public/          Static assets and PWA icons
```

---

## First Steps After Setup

1. Log in and create an admin account
2. Go to **Admin → Event** and either:
   - Enter a real TBA event key (e.g. `2026miket`) and click **Sync TBA**, or
   - Set your team number and click **Create Mock Event** to generate test data
3. In **Admin → Config**, activate a scouting config
4. In **Admin → Assignments**, generate scout assignments
5. Scouts can now log in and access their assignments on the **Scout** tab
