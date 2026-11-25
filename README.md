# CloudShield

CloudShield gives project teams a private room for TL-issued access keys, shared files, and handoffs.

## Run & Operate

- Configure `DATABASE_URL` with the **Session Pooler** connection string from your Supabase project's **Connect** dialog. The direct database endpoint resolves to IPv6 only on this machine and times out; use the Session Pooler (port 5432) for the API. Keep the password URL-encoded and use SSL (`sslmode=require&uselibpqcompat=true`). The compatibility flag preserves standard `require` behavior for the installed PostgreSQL URL parser; it encrypts traffic but does not validate the server certificate.
- Configure Clerk's development publishable and secret keys from your Clerk instance; do not commit keys to the repository.
- Create a **private** Supabase Storage bucket named `cloudshield-files` (or set `SUPABASE_STORAGE_BUCKET` to your bucket name). Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY` in the root `.env`. A legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported, but a publishable key alone cannot authorize private uploads. Never expose the secret key to Vite or commit it. The API creates signed upload URLs and serves private room files through authenticated API routes.
- `pnpm --filter @workspace/db run push` — push DB schema changes to the configured Supabase database (dev only)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

### Start locally on Windows (PowerShell)

Run these commands from the repository root in separate PowerShell terminals. Start the backend first; Vite proxies `/api` requests to `http://127.0.0.1:5000`. Replace the database URL with your Supabase **Session Pooler** URI, then push the schema before launching the API:

**Backend terminal**

```powershell
$env:DATABASE_URL = "<Supabase Session Pooler URI from Connect>"
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "sb_publishable_<your-publishable-key>"
$env:SUPABASE_SECRET_KEY = "<server-only secret key>"
$env:SUPABASE_STORAGE_BUCKET = "cloudshield-files"
$env:PORT = "5000"
$env:CLERK_PUBLISHABLE_KEY = "pk_test_<your-Clerk-publishable-key>"
$env:CLERK_SECRET_KEY = "sk_test_<your-Clerk-secret-key>"
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
```

**Frontend terminal**

```powershell
$env:VITE_CLERK_PUBLISHABLE_KEY = "pk_test_<your-Clerk-publishable-key>"
pnpm --filter @workspace/cloudshield run dev
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cloudsheild/src/App.tsx` — landing, Clerk auth, dashboard, project room, and upload UI
- `artifacts/cloudsheild/src/index.css` — CloudShield theme, Clerk layer, and motion utilities
- `lib/api-spec/openapi.yaml` — source of truth for dashboard, projects, files, and storage API contracts
- `artifacts/api-server/src/routes/projects.ts` — authenticated project room and file metadata routes
- `lib/db/src/schema/index.ts` — project, member, and file metadata tables
- `artifacts/api-server/src/routes/storage.ts` — protected presigned upload and object serving routes

## Architecture decisions

- Clerk owns account creation, email/password sign-in, and Google sign-in; the browser uses Clerk session cookies.
- File bytes go directly to a private Supabase Storage bucket through signed upload URLs; PostgreSQL stores only searchable metadata and object paths.
- Project reference keys use the Block Design Protocol format `BLK-COMPANY-TITLE-RANDOMBLOCK`.
- Project rooms are shared by authenticated membership records, while TL ownership is derived from the project owner.

## Product

- Public CloudShield landing page
- Branded sign-in and sign-up screens with Google option
- Authenticated dashboard with project counts, recent activity, and empty/error/loading states
- Create project rooms with company, title, TL name, and generated reference key
- Join rooms with company, person, project title, and the TL-issued reference key
- Shared file uploads for TLs and members, with direct cloud storage and room metadata

## User preferences

The app name is spelled “CloudShield”.

## Gotchas

- Clerk's Google provider and production credentials are managed by Clerk configuration.
- Production Vite builds need the artifact workflow's `PORT` and `BASE_PATH` values.

## Pointers

- See workspace structure, TypeScript setup, and package details in `pnpm-workspace.yaml`.
