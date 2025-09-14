# CLAUDE.md — BKFlow

> Primary guidance for Claude coding sessions. Read this first, then read `AGENTS.md`. For deep dives, see `docs/ai/`.

## Quick Context

BKFlow is a **Next.js 16 / React 19** Trello-style kanban app using App Router. It is a **mono-repo** — frontend, backend logic, auth, and database all live in the same Next.js app. Do not separate them.

**Stack snapshot:** Next.js 16, React 19, TypeScript strict, Tailwind CSS v4, shadcn/Radix UI, Clerk (auth + orgs), Prisma + MySQL, Stripe subscriptions, TanStack Query, Zustand, `@hello-pangea/dnd`, Zod v4.

## Before You Write Code

1. Read `AGENTS.md` — it is the primary source of truth.
2. Read the file(s) nearest to the change you are making.
3. Read the relevant `docs/` file if behavior is unclear.
4. Match the existing pattern. Do not invent new abstractions.

## The Three Most Important Patterns

### 1. Server Actions (mutations)

Every mutation follows this three-file pattern under `actions/<name>/`:

```
index.ts   — "use server" at top, export createSafeAction(Schema, handler)
schema.ts  — Zod v4 schema (use z.string("msg"), not required_error/invalid_type_error)
types.ts   — InputType = z.infer<Schema>, ReturnType = ActionState<InputType, Model>
```

The handler always: `auth()` → check orgId → scope query by orgId → mutate → `createAuditLog()` → `revalidatePath()` → return `{ data }` or `{ error }`.

### 2. Client → Server boundary

- **Server Components** (no `"use client"`) → call Prisma directly, call `auth()` directly.
- **Client Components** (`"use client"`) → call Server Actions via `useAction()`, or fetch via React Query + `fetcher()`.
- Never call Prisma from a Client Component. Never use hooks in a Server Component.

### 3. State layers

| What | How |
|------|-----|
| Page data | Server Component + `revalidatePath()` |
| Card modal data | React Query (`["card", id]`, `["card-logs", id]`) |
| Global modal/sidebar open state | Zustand store in `hooks/` |
| Local inline form / edit state | `useState` inside the component |

## Dangerous Files — Think Before Touching

| File | Why dangerous |
|------|--------------|
| `middleware.ts` | Must keep `/api/webhook` public for Stripe |
| `app/api/webhook/route.ts` | Must use `req.text()` — never `req.json()` |
| `prisma/schema.prisma` | Cascade deletes are intentional |
| `lib/org-limit.ts` | Board counts must stay consistent with create/delete |
| `lib/subscription.ts` | Subscription expiry check has a 1-day buffer |
| `list-container.tsx` (DnD) | Optimistic UI — no rollback on server error |

## Common Gotchas

- **Zod v4**: Use `z.string("message")` for required/type errors. `required_error` and `invalid_type_error` are removed.
- **Next.js 16 dynamic routes**: `await params` and `await headers()` before reading.
- **Stripe webhook**: `payment_method_types` should not be hardcoded; use Stripe Dashboard dynamic methods.
- **Unsplash image payload**: pipe-separated `"id|thumb|full|link|user"` — both `FormPicker` and `create-board` must stay aligned.
- **`useIsMounted()`**: Use this hook (not a local `useState`/`useEffect`) as the client-only render gate.
- **Clerk `pageSize`**: Use `pageSize`, not `limit`, for paginated Clerk SDK calls.
- **OrgLimit sync**: Free orgs only — `incrementAvailableCount()` on create, `decreaseAvailableCount()` on delete, only when `!isPro`.

## Workflow

```
npm run lint       — always run after source changes
npm run build      — run for routing, type boundary, or Stripe/Prisma changes
```

Manual browser check is expected for: forms, modals, DnD, billing redirects, navigation.

There are no automated tests beyond lint + build.

## What NOT to Do

- Do not add a new state library, component system, or API layer.
- Do not reorganize folder structure or rename routes.
- Do not add a local `User` table (Clerk owns users).
- Do not call Prisma from a Client Component.
- Do not use `req.json()` in `app/api/webhook/route.ts`.
- Do not skip `createSafeAction()` for mutations.
- Do not skip `orgId` scoping in any DB query that touches org-owned data.

## More Detail

- Architecture: `docs/ai/architecture-summary.md`
- Coding rules: `docs/ai/coding-rules.md`
- Do-not-break list: `docs/ai/do-not-break.md`
- Project memory: `docs/ai/project-memory.md`
- UI patterns: `docs/ai/ui-philosophy.md`
- Frontend patterns: `docs/ai/frontend-patterns.md`
- Workflow guidance: `docs/ai/claude-workflow.md`
