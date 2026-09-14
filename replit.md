# CloudSheild

CloudSheild gives project teams a private room for TL-issued access keys, shared files, and handoffs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cloudsheild/src/App.tsx` — landing, Clerk auth, dashboard, project room, and upload UI
- `artifacts/cloudsheild/src/index.css` — CloudSheild theme, Clerk layer, and motion utilities
- `lib/api-spec/openapi.yaml` — source of truth for dashboard, projects, files, and storage API contracts
- `artifacts/api-server/src/routes/projects.ts` — authenticated project room and file metadata routes
- `lib/db/src/schema/index.ts` — project, member, and file metadata tables
- `artifacts/api-server/src/routes/storage.ts` — protected presigned upload and object serving routes

## Architecture decisions

- Clerk owns account creation, email/password sign-in, and Google sign-in; the browser uses Clerk session cookies.
- File bytes go directly to App Storage through presigned URLs; PostgreSQL stores only searchable metadata and object paths.
- Project reference keys use the Block Design Protocol format `BLK-COMPANY-TITLE-RANDOMBLOCK`.
- Project rooms are shared by authenticated membership records, while TL ownership is derived from the project owner.

## Product

- Public CloudSheild landing page
- Branded sign-in and sign-up screens with Google option
- Authenticated dashboard with project counts, recent activity, and empty/error/loading states
- Create project rooms with company, title, TL name, and generated reference key
- Join rooms with company, person, project title, and the TL-issued reference key
- Shared file uploads for TLs and members, with direct cloud storage and room metadata

## User preferences

The app name is spelled “CloudSheild”.

## Gotchas

- Clerk's Google provider and production credentials are managed by the Auth pane; development uses the Replit-managed Clerk test environment.
- Production Vite builds need the artifact workflow's `PORT` and `BASE_PATH` values.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
