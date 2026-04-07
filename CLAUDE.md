# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Revold is a revenue intelligence platform (French-language UI) targeting the B2B French market. Currently at "functional mockup" stage — well-structured Next.js shell with no real backend yet.

## Roadmap

**Always read `roadmap.md` at the start of each session.** It contains the full development plan, current phase, task statuses, and session journal. Update it after each work session:
- Mark completed tasks with `[x]`
- Add a row to the "Journal de Sessions" table
- Update the "Statut global" line if the phase changes

Current phase: **Phase 1 — Fondations** (auth, DB schema, middleware, env validation, error boundaries, testing, dev tooling).

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — run ESLint
- No test framework configured yet (Phase 1.7)

## Stack

- **Next.js 16** (App Router) with React 19 and TypeScript (strict)
- **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme inline` in `globals.css`)
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`); helpers in `lib/supabase/`
- Deployed on **Vercel** (`vercel.json`)
- Font: DM Sans (`next/font/google`)

## Important: Next.js 16 breaking changes

Read `node_modules/next/dist/docs/` before writing code — APIs and conventions may differ from earlier Next.js versions. See `AGENTS.md`.

## Architecture

- **App Router with route groups**: `app/(dashboard)/` wraps authenticated pages with shared layout (sidebar + header).
- **Auth**: Currently demo-mode — `app/login/actions.ts` sets a static cookie. Supabase helpers exist in `lib/supabase/` but aren't wired in yet. Replacing this is Phase 1.1.
- **Server Actions**: Login/logout use `"use server"` actions with `cookies()` and `redirect()`.
- **Shared components**: `components/` — layout pieces (`dashboard-header`, `dashboard-sidebar`) and reusable UI (`progress-score`, `revold-logo`).
- **No middleware.ts yet** — auth gating is in the layout, not at the edge. Adding this is Phase 1.2.
- **All dashboard data is hardcoded** — KPIs and scores are JS constants in the page file. Wiring to Supabase is Phase 2.1.

## Styling

Tailwind v4 with CSS variables in `globals.css` (`--background`, `--card`, `--accent`, etc.) via `@theme inline`. `.card` utility class for card appearance. Slate/indigo color scheme.

## Environment variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No `.env.example` yet (Phase 1.5). No runtime validation yet — env vars use `!` assertions.

## Language

All user-facing text is in **French**.

## Key Decisions

- **Multi-tenant via RLS**: Every data table has `organization_id`, isolated at DB level.
- **Schema-first**: Build DB schema before UI features.
- **Component strategy**: Radix UI Primitives + Tailwind or minimal `components/ui/` (to decide in Phase 2).
- **KPI engine**: Pure functions in `lib/kpi/`, unit tested, feeding `kpi_snapshots` table.
