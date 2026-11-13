# Doctor Tracker backend

## Elevator pitch

The Doctor Tracker backend is a standalone Express 5 REST API for the secure administration of doctors, patients, and clinic activity. It owns Admin authentication, request validation, patient assignment rules, MongoDB persistence, indexed list queries, and dashboard aggregation. The separate Next.js frontend reaches it through a same-origin rewrite.

## Responsibilities and API

- Admin login, current-session checks, logout, and session revocation.
- Doctor creation, listing, search, date/facet filtering, pagination, detail, and patient counts.
- Doctor-scoped patient list/create/delete operations.
- Global patient list/create/detail/edit/reassignment/delete operations.
- Dashboard summary with all-time totals, reporting-window metrics, chart datasets, and recent patients.
- Liveness/readiness endpoints and centralized request validation/error handling.

The browser-facing `/api/*` path is rewritten to Express `/api/v1/*` by Next.js. The REST contract documents request/response fields, query parameters, date semantics, and error codes: [API contract](docs/API_CONTRACT.md).

## Architecture

```mermaid
flowchart LR
  Browser[Browser] -->|/api/*| Next[Next.js rewrite]
  Next -->|/api/v1/*| Router[Express router]
  Router --> Middleware[Origin, session, and validation middleware]
  Middleware --> Controller[Module controller]
  Controller --> Service[Module service]
  Service --> Repository[MongoDB repository]
  Repository --> Mongo[(MongoDB)]
  Next -->|Uncached /auth/me| Router
```

The API is a modular monolith. `auth`, `doctors`, `patients`, and `dashboard` own their routes and business logic. Controllers translate HTTP requests, services enforce rules and compose reads, and repositories own persistence and projections. Runtime-neutral DTOs and Zod schemas are shared from `packages/contracts`.

## Data and security

- MongoDB collections: `users`, `sessions`, `doctors`, and `patients`.
- Patients are stored separately from doctors and reference a doctor ObjectId. Reassignment updates the patient’s doctor; patient counts are derived from the patient collection.
- Passwords use Argon2id. Sessions use opaque random tokens, store only token digests, expire after 12 hours, and are issued in an HttpOnly, SameSite cookie.
- Protected endpoints require the Admin role. Mutations validate the configured browser origin, JSON request bodies are size-limited, and login attempts are rate-limited.
- Protected responses are marked private/no-store. Do not place patient data, passwords, cookies, or database credentials in logs or screenshots.

## Local setup

Use Node.js 24 LTS, npm, and a reachable MongoDB 7 instance or Atlas cluster. From the workspace root:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
npm ci
```

Set `MONGODB_URI` in `backend/.env`. Set `PUBLIC_APP_ORIGIN` to the exact browser origin, and provide a unique `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` for the one-time provisioning step. The example file contains placeholders, not usable credentials.

Deploy declared indexes, provision an Admin, and optionally insert the synthetic dashboard dataset:

```powershell
npm run indexes:deploy -w @doctor-tracker/backend
npm run admin:provision -w @doctor-tracker/backend
npm run dashboard:seed -w @doctor-tracker/backend
```

The dashboard seed is repeatable. It creates 500 marked demo doctors and 30,000 synthetic patients with uneven workloads and deterministic pseudorandom timestamps from January 1, 2025 through the time the seed runs. The first and last patient records anchor that date range. Every demo doctor receives at least 15 patients; larger workloads taper deterministically across the directory. On a subsequent run it removes only those demo doctors and their assigned patients before recreating the data.

To clear application data while preserving Admin accounts, run this destructive command with an explicit confirmation matching the database name in `MONGODB_URI`:

```powershell
npm run data:clear -w @doctor-tracker/backend -- --confirm doctor_tracker
```

Replace `doctor_tracker` with the actual database name. The command deletes all doctors, patients, and sessions in that database, leaves user/Admin accounts intact, and refuses to run when `NODE_ENV=production`. Clearing sessions signs out all Admins. It does not run automatically during setup or seeding.

Run both applications from the workspace root with `npm run dev`; the API listens on port `4000` by default. To run only the API, use:

```powershell
npm run dev -w @doctor-tracker/backend
```

The frontend server origin is configured by `BACKEND_ORIGIN` in `frontend/.env.local`. In local development it defaults to `http://127.0.0.1:4000`.

## Configuration

See [backend/.env.example](.env.example) for the complete sample. The main settings are:

| Variable                                      | Purpose                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                 | MongoDB connection string.                                                                |
| `PORT`                                        | API listen port; defaults to `4000`.                                                      |
| `PUBLIC_APP_ORIGIN`                           | Exact allowed origin for browser mutations.                                               |
| `TRUST_PROXY_HOPS`                            | Trusted reverse-proxy hop count; set it for the deployment topology.                      |
| `NODE_ENV`                                    | Controls production cookie behavior.                                                      |
| `REPORTING_TIME_ZONE`                         | Reporting calendar for list date filters and dashboard buckets; defaults to `Asia/Dhaka`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Used by `admin:provision`; not read during login.                                         |

The frontend’s server-only `BACKEND_ORIGIN` must point to this API and must not be exposed as a `NEXT_PUBLIC_` variable. Do not commit `.env` files.

## Indexes and query measurement

Create the indexes declared by the Mongoose models with:

```powershell
npm run indexes:deploy -w @doctor-tracker/backend
```

After loading the synthetic dataset, capture `explain("executionStats")` results and a dashboard summary latency sample:

```powershell
npm run query:measure -w @doctor-tracker/backend
```

The output records dataset size, examined keys/documents, returned rows, blocking-sort presence, and `30d` dashboard summary latency. Measurements are environment- and dataset-dependent; no numbers are claimed here until captured against a reachable MongoDB instance. See [backend architecture](docs/ARCHITECTURE.md) for expected query shapes.

## Verification

From the workspace root:

```powershell
npm run lint
npm run typecheck
npm run build
npm run format:check
```

The API integration suite requires `MONGODB_TEST_URI` pointing to the dedicated database named exactly `doctor_tracker_test`. It drops that database before and after the run and does not fall back to `backend/.env`:

```powershell
$env:MONGODB_TEST_URI = "mongodb://127.0.0.1:27017/doctor_tracker_test"
npm run test:integration
```

Only use a disposable test database. The test workflow covers unauthenticated access, invalid credentials, duplicate and concurrent doctor creation, scoped delete behavior, patient list secrecy, reassignment, dashboard totals, deletion, and session revocation.

## Health checks and deployment

- `GET /api/v1/health/live` reports that the process is running.
- `GET /api/v1/health/ready` returns readiness based on MongoDB connectivity.

Run Express behind the same browser-visible HTTPS origin as Next.js. Configure `PUBLIC_APP_ORIGIN`, server-only `BACKEND_ORIGIN`, `TRUST_PROXY_HOPS`, and a least-privileged MongoDB account for the actual topology. Verify cookie set/forward/clear behavior, origin checks, no-store headers, rate limiting, and both health endpoints through the real ingress. No deployment target or credentials are configured in this workspace.

See the [frontend README](../frontend/README.md) for the client setup and visual-evidence checklist, and the [full-stack assignment](../docs/Fullstack_Task_Requirment.md) for submission requirements.
