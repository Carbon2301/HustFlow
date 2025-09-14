# BKFlow Agent Guide

This repository is a Next.js App Router kanban-style workspace app. Treat the existing docs and implementation as source of truth. Prefer small, consistent changes over broad refactors.

## Next.js Version Warning

This app uses a newer Next.js/App Router stack than many older examples. APIs, conventions, and file structure may differ from training-data-era Next.js. When touching Next.js-specific behavior, prefer this repo's current patterns and check local Next docs in `node_modules/next/dist/docs/` if an API looks unfamiliar.

## Read First

Before changing code, read:

- `docs/architecture.md`
- `docs/project-structure.md`
- `docs/database.md`
- `docs/flows.md`
- `docs/features.md`
- `docs/code-explanation.md`
- `prisma/schema.prisma`
- The existing files nearest to the change

AI-specific memory lives in `docs/ai/`.

## Core Architecture

- Next.js App Router combines frontend and backend in one app.
- Server Components fetch directly from Prisma when rendering pages.
- Client Components call Server Actions for mutations or API routes for React Query reads.
- Clerk owns auth, users, and organizations. The app stores Clerk `orgId` and user snapshots only where needed.
- Prisma uses MySQL models: `Board`, `List`, `Card`, `AuditLog`, `OrgLimit`, and `OrgSubscription`.
- Stripe subscription state is written by `app/api/webhook/route.ts` and read by `lib/subscription.ts`.
- Board background images come from Unsplash and must retain attribution fields.

## Conventions To Preserve

- Server Actions live under `actions/<action-name>/` with `index.ts`, `schema.ts`, and `types.ts`.
- `actions/*/index.ts` starts with `"use server"` and exports `createSafeAction(Schema, handler)`.
- Validate inputs with Zod schemas in `schema.ts`.
- Return action results in the existing `{ data }`, `{ error }`, or `{ fieldErrors }` shape.
- Check `auth()` in every server action/API route that touches org data.
- Scope Prisma queries by `orgId`, usually with nested filters like `list: { board: { orgId } }`.
- Call `revalidatePath()` after mutations that affect Server Component data.
- Use `createAuditLog()` for user-visible create/update/delete events unless the existing nearby action does not.
- Keep Client Components marked with `"use client"` only when they need hooks, browser APIs, DnD, or event handlers.
- Use `useAction()` from client components for Server Actions.
- Use React Query plus `lib/fetcher.ts` for card modal GET endpoints.
- Use Zustand stores for app-wide UI state such as modals and mobile sidebar.
- Use shadcn/Radix UI components, Tailwind utilities, `cn()`, and lucide icons.

## Dangerous Areas

- `middleware.ts`: protects routes and keeps `/api/webhook` public for Stripe.
- `app/api/webhook/route.ts`: must use raw `req.text()` for Stripe signature verification.
- `prisma/schema.prisma`: cascade deletes are intentional for Board -> List -> Card.
- Drag-and-drop ordering in `list-container.tsx` and order update actions relies on optimistic UI plus Prisma transactions.
- `lib/org-limit.ts`: free board limits depend on `OrgLimit`; board creation/deletion must keep counts consistent.
- `lib/subscription.ts` and `actions/stripe-redirect`: changing Stripe behavior can break billing and board limits.
- Unsplash image pipe encoding in `FormPicker` and `create-board` must stay aligned.

## Workflow

1. Read nearby files and relevant docs.
2. Match the existing pattern before introducing a new abstraction.
3. Keep edits scoped to the feature or bug.
4. Run `npm run lint` when code changes.
5. For UI changes, run the app and verify the affected screen in a browser.

There are no dedicated test scripts in `package.json` currently; lint is the default automated check.
