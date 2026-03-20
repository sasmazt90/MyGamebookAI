# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyGamebookAI is a full-stack web application for creating, publishing, and reading AI-generated interactive gamebooks with branching narratives. Users spend credits to generate stories across multiple genres (fairy tales, comics, crime/mystery, fantasy/sci-fi, romance, horror/thriller), with AI-generated text and images.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR)
pnpm build        # Build frontend (Vite) + bundle server (esbuild)
pnpm start        # Run production build
pnpm check        # TypeScript type-check only (no emit)
pnpm format       # Format with Prettier
pnpm test         # Run all tests with Vitest
pnpm db:push      # Generate + apply Drizzle migrations
```

Run a single test file:
```bash
pnpm test server/pricing.test.ts
```

## Architecture

**Stack:** React 19 + Vite 7 (frontend) / Express + tRPC 11 (backend) / Drizzle ORM + MySQL (data) / Cloudflare R2 (storage) / Google Gemini (AI)

**Monorepo layout:**
- `client/` — React SPA (Wouter routing, Tailwind CSS 4, Radix UI, Framer Motion)
- `server/` — Express server with tRPC routers, all business logic
- `shared/` — Constants, pricing logic, sound library (used by both client and server)
- `drizzle/` — Database schema (`schema.ts`, `relations.ts`) and 18 SQL migration files

**Path aliases:** `@` → `client/src`, `@shared` → `shared/`, `@assets` → `attached_assets/`

### Request Flow

Browser → Wouter SPA → tRPC client (`client/src/lib/trpc.ts`) → Express `/api/trpc` → tRPC routers (`server/routers/`) → Drizzle ORM → MySQL

Stripe webhooks bypass tRPC and hit `/api/stripe/webhook` directly.

### tRPC Routers

All routers are assembled in `server/routers.ts` and mounted at `/api/trpc`. Key routers:
- `auth` — login/register/logout/me (JWT + bcrypt, no third-party OAuth)
- `books` — CRUD for gamebooks and pages
- `credits` — wallet and transaction management
- `admin` — admin operations (protected by admin role check)
- `stripe` — payment integration
- `moderation`, `reviews`, `notifications`, `banners`, `profile`

Auth context is resolved in `server/_core/context.ts` by reading the `auth_token` cookie and verifying the JWT.

### Book Generation

`server/generationWorker.ts` orchestrates the full book generation pipeline:
1. Validate inputs and deduct credits upfront
2. Call LLM (Gemini) for story content page by page
3. Call image provider (Google or Forge) per page
4. Upload images to R2, store results in DB
5. Mark book as complete or roll back credits on failure

Image generation is in `server/_core/imageGeneration.ts`. The `IMAGE_PROVIDER` env var switches between `google` and `forge` providers.

### Frontend Structure

- `client/src/pages/` — One file per route (16 pages)
- `client/src/components/` — Shared UI components (40+ files); complex book reader logic lives in `Reader.tsx`
- `client/src/hooks/` — Custom hooks for flipbook animation (`useFlipbook`), audio, etc.
- `client/src/contexts/` — `ThemeContext`, `LanguageContext` (i18n)
- `client/src/lib/` — tRPC client setup, i18n utilities

### Database

Schema is defined in `drizzle/schema.ts`. Key tables: `users`, `profiles`, `wallets`, `books`, `bookPages`, `reviews`, `credits`, `notifications`, `banners`, `moderationQueue`.

Always run `pnpm db:push` after modifying `drizzle/schema.ts`.

## Testing

311 tests across 12 files, all in `server/`. Notable test files:
- `colourlock.test.ts` — 144 tests for illustration style/colour consistency across genres
- `pricing.test.ts` — 34 tests for the credit pricing system (`shared/pricing.ts`)
- `safeguards.test.ts` — 22 validation/guardrail tests
- `auth.custom.test.ts` — 17 auth flow tests

Tests mock external dependencies (DB, LLM, R2). Do not add real API calls in tests.

## Deployment

- **Frontend:** Vercel (configured in `vercel.json`); routes `/api/trpc/*` to the backend via rewrites
- **Backend:** Railway (`mygamebookai-production.up.railway.app`)
- **Storage:** Cloudflare R2 (S3-compatible API via `server/storage.ts`)

## Key Environment Variables

```
DATABASE_URL          # MySQL connection string
JWT_SECRET            # JWT signing secret
IMAGE_PROVIDER        # "google" or "forge"
GOOGLE_API_KEY        # Gemini API key
GOOGLE_IMAGE_MODEL    # e.g. gemini-2.0-flash-exp
R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET_NAME / R2_PUBLIC_BASE_URL
STRIPE_SECRET_KEY
VITE_APP_ID
```

## Notable Patterns

- **Credits are deducted before generation begins** — rollback on failure is handled explicitly in `generationWorker.ts`
- **Genre-specific rendering** — `Reader.tsx` uses the book's `category` field to switch between visual styles (flip-book, comic panels, desk-calendar, etc.) with Framer Motion animations
- **i18n** — All user-facing strings go through the language context; avoid hardcoded English strings in components
- **Shared pricing logic** — Credit costs live in `shared/pricing.ts` and are imported by both client (display) and server (enforcement)
