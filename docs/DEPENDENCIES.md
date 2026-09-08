# Dependencies

One line per **direct** dependency saying what it is for (H36). The unit test
`src/lib/repo-invariants.test.ts` fails CI if `package.json` and this table
disagree in either direction, so add the line in the same commit as the
package.

Before adding anything, ask: is it in the decided stack, or required by the
current phase's tasks? If neither, do not add it.

## Runtime (`dependencies`)

| Package                    | Why                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                     | The framework. App Router, server components, route handlers. Decided in the brief.                                                    |
| `react`                    | Required by Next.js.                                                                                                                   |
| `react-dom`                | Required by Next.js.                                                                                                                   |
| `radix-ui`                 | Unstyled, accessible primitives that shadcn/ui components are built on. Installed by `shadcn init`.                                    |
| `class-variance-authority` | Variant-to-className mapping used by every shadcn/ui component. Installed by `shadcn init`.                                            |
| `cn`                       | shadcn's className merge helper (clsx + tailwind-merge in one). Re-exported from `src/lib/utils.ts`. Installed by `shadcn init`.       |
| `lucide-react`             | Icon set shadcn/ui components import from. Installed by `shadcn init`.                                                                 |
| `drizzle-orm`              | Query builder and the schema (`src/db/schema.ts`) that migrations and inferred types come from. Decided over Prisma in Phase 0 review. |
| `postgres`                 | postgres.js driver Drizzle uses; supports the transaction pooler with `prepare: false`.                                                |
| `@supabase/supabase-js`    | Supabase Auth client (magic links) and the admin API used by seed and tests. Never used for data access.                               |
| `@supabase/ssr`            | Cookie-based Supabase Auth sessions for Next.js server components, actions and proxy.                                                  |
| `zod`                      | Boundary validation: env, form data, search params, request bodies (CLAUDE.md > Conventions).                                          |
| `@sentry/nextjs`           | Error tracking. Inert without `NEXT_PUBLIC_SENTRY_DSN`. Decided in Phase 0 review to scaffold at the start of Phase 1.                 |

## Build and development (`devDependencies`)

| Package                | Why                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`           | The language. Strict mode plus `noUncheckedIndexedAccess` and `noImplicitOverride`.                                                                                                 |
| `@types/node`          | Node type definitions for config files and the test harness. Major version tracks `.nvmrc`.                                                                                         |
| `@types/react`         | React type definitions.                                                                                                                                                             |
| `@types/react-dom`     | React DOM type definitions.                                                                                                                                                         |
| `eslint`               | Linting. `@typescript-eslint/no-explicit-any` is an error.                                                                                                                          |
| `eslint-config-next`   | Next.js, React, hooks, and TypeScript lint rules in one shareable config.                                                                                                           |
| `prettier`             | Formatting. `format:check` runs in CI.                                                                                                                                              |
| `tailwindcss`          | Utility CSS. The token layer in `src/app/globals.css` is exposed to Tailwind through its `@theme` block.                                                                            |
| `@tailwindcss/postcss` | The PostCSS plugin Next.js uses to run Tailwind v4.                                                                                                                                 |
| `shadcn`               | The shadcn/ui CLI (`npx shadcn add <component>`). Also ships `shadcn/tailwind.css`, the custom variants its components rely on (build-time).                                        |
| `tw-animate-css`       | Enter/exit animation utilities shadcn/ui components use. Build-time CSS only. Installed by `shadcn init`.                                                                           |
| `vitest`               | Unit test runner.                                                                                                                                                                   |
| `@playwright/test`     | End-to-end test runner. Chromium only in CI to keep runs short.                                                                                                                     |
| `drizzle-kit`          | Generates and applies the forward-only SQL migration chain from `src/db/schema.ts`. Its `npm audit` finding is a dev-server esbuild issue in a bundled loader that never runs here. |
| `supabase`             | Supabase CLI, used ONLY to run the local Postgres/Auth/Mailpit instance in dev and CI (`npm run db:start`). Never for migrations.                                                   |
| `tsx`                  | Runs TypeScript scripts (`scripts/*.ts`: seed, bootstrap, type generation) without a build step.                                                                                    |

## Deliberately not installed yet

- **TanStack Query** — added with the first client-side server state.
