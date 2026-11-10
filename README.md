# UoH Dormitory

Next.js App Router application with TypeScript pages, components, and server API handlers. The legacy Python service is not required. Arabic/English UI, RTL layout, and student, staff, and administrator workflows are preserved.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Select a demo account on the login screen, or use `admin@uoh.edu.sa`, `staff@uoh.edu.sa`, or `student@uoh.edu.sa` with any nonempty password. These are simulated accounts, not production authentication.

No database or authentication configuration is needed for the demo. The API reads `demo/seed.json` initially, then persists changes to ignored `demo/data.json`; uploaded files live in `demo/uploads/`. To reset the demo, stop the app and delete `demo/data.json` and the uploaded files. `DEMO_DATA_FILE` can select an isolated data file. JSON writes are serialized within one Node process and saved atomically.

```sh
npm run typecheck
npm run build
npm start
```

Development uses `.next-dev`; production uses `.next-build`, so a production build does not overwrite a running development server's chunks. If a previously running server still serves stale chunks, stop that process and restart `npm run dev`, then reload the browser.

## Converted features

- Role-specific dashboards with request totals, nationality charts, residency-expiry alerts, recent announcements, and permission summaries.
- Student records, search/filtering, account creation, editing, deletion, and passport/residency attachments.
- Staff and administrator account management, with role restrictions.
- Student profiles, attachment uploads, previews, downloads, and removal from profiles.
- Complaints, document requests, and leave permissions, including staff status updates and responses.
- Bilingual pinned announcements.
- Forms with six question types, required-answer validation, response editing, activation controls, response lists/counts, and CSV export.
- Notification counts and read markers.

All legacy API paths are implemented through `src/app/api/[[...path]]/route.ts`. Domain logic lives in typed modules under `src/lib/demo/`; UI screens live in `src/screens/`, with page routes under `src/app/`. API errors are validated and returned as structured responses. Requests have a timeout, and dashboards show retryable errors instead of an indefinite loading screen.

## Your Neon and Better Auth integration

`prisma/schema.prisma` is now a Prisma 8 native PostgreSQL contract. `prisma.config.ts` points to it and emits artifacts into `src/prisma`. The project pins the available `prisma` CLI and `@prisma/orm-postgres` runtime to `8.0.0-rc.11`, with TypeScript 5.9.3. Prisma 8 is a release candidate. The runnable demo deliberately continues using JSON instead of a database connection. No real data or credentials were copied from the old project.

Replace the demo identity lookup in `src/lib/demo/service.ts` with Better Auth session validation and adapt `src/context/AuthContext.tsx` to its login/session endpoints. The `demo_user` cookie is only a local role simulator and must be replaced before deployment. Align Prisma's User model with Better Auth's generated schema; the current `password_hash` field reflects the legacy model, not a configured Better Auth implementation.

Replace `src/lib/demo/store.ts` and the domain modules' in-memory collection operations with Prisma queries/transactions, preserving the existing API response shapes used by the UI. Supply `DATABASE_URL` in the command environment when you connect Neon. Run `npm run db:emit` to emit the contract, `npm run db:plan -- --name init` to plan migrations, and review them before `npm run db:migrate`. Prisma 8 has no `prisma generate` command. The new runtime uses `@prisma/orm-postgres/runtime` and the emitted contract, not `@prisma/client`. Replace local upload storage with persistent storage for deployment.

PWA support is intentionally deferred. There is no service worker or offline cache.

## Verification

The conversion passed strict TypeScript checking and 75 isolated API checks covering role restrictions, CRUD, uploaded-file ownership, form validation/upserts, CSV export, notifications, and concurrent JSON persistence. The verification script was run outside the repository; no deleted test or backend directory was restored.

In the conversion environment, Next.js compiled successfully and generated all 13 pages, but its final build cleanup was blocked by an OS `EPERM` on `rmdir`. A complete production build and browser check after restarting the local server remain to be verified on an unrestricted local run.

## Prisma 8 upgrade verification

Dependency resolution and lockfile generation succeeded for the pinned RC versions. Full CLI installation was blocked by insufficient local disk space (ENOSPC); newer RC versions also referenced packages unavailable from the registry. Contract emission and database migration have not been verified. The post-upgrade typecheck is currently blocked by the two uninstalled config imports (`@prisma/cli-engine` and `@prisma/orm-postgres/config`). Free disk space, run `npm install --legacy-peer-deps`, then `npm run db:emit` and `npm run typecheck`. No database connection or data migration was attempted. The config reads environment variables supplied by the caller; it does not automatically load environment files.
