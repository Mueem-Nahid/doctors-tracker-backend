# Doctor Tracker backend architecture

[REST contract](API_CONTRACT.md) · [Frontend plan](https://github.com/Mueem-Nahid/doctors-tracker-frontend/blob/main/docs/IMPLEMENTATION_PLAN.md)

## Runtime and module boundaries

Build one Express API process per replica with a single MongoDB connection pool per process. Use a supported Node.js LTS, Express 5, strict TypeScript, Mongoose, and Zod. Keep `app.ts` free of startup side effects so integration tests can mount the same app. `server.ts` validates configuration, connects to MongoDB, starts the listener, and drains HTTP requests and closes the database pool on shutdown. Pin compatible versions and build with `tsc`. [Node.js release schedule](https://nodejs.org/en/about/previous-releases) · [Express 5 error handling](https://expressjs.com/en/5x/guide/error-handling/)

```text
Browser ── /pages ─────────► Next.js App Router
Browser ── /api/* ─────────► same-origin rewrite ──► Express /api/v1/*
Next.js protected pages ───► Express /api/v1/auth/me
Express routes ──► validation / authorization ──► controllers
Controllers ──► services ──► module repositories ──► MongoDB
```

The [food-ordering reference](../food-ordering-system-backend/) establishes the folder pattern. Follow its separation of `app.ts` and `server.ts`, central router, route/controller/service/validation/model files per feature, and global errors. For Doctor Tracker, add focused repository files for query-heavy modules, pass the parsed Zod result to controllers, mount each resource router once, and use Express 5's async error handling. The reference's `auth.service.ts` has password comparison commented out, its request validator discards parsed values, and its list service accepts dynamic regex and sort values. Implement those paths from the rules below and the API contract.

```text
backend/
  src/
    app.ts
    server.ts
    config/                     # Validated env and MongoDB connection setup
    app/
      routes/index.ts           # Mount each module router under /api/v1
      middlewares/              # Validation, session guard, request ID, error mapping
      modules/
        auth/                   # Users, sessions, login, logout, me, Admin provisioning
        doctor/                 # Doctor model, create/read, doctor filters
        patient/                # Patient model, global and doctor-scoped workflows
        dashboard/              # Read-only summary and date buckets
    errors/                     # Typed application errors and HTTP mapping
    shared/                     # Pagination and response helpers
  scripts/                      # Admin provisioning, index deployment, synthetic seed
  tests/integration/
  docs/
packages/contracts/             # Runtime-neutral Zod DTOs, query schemas, TS types
```

Use feature files named `<module>.route.ts`, `.controller.ts`, `.service.ts`, `.validation.ts`, `.model.ts`, and `.repository.ts` where applicable. Export only the operations another module needs through a module entry point. Controllers handle HTTP and forward validated values. Services enforce invariants and compose reads. Repositories own projections, indexes, and persistence. Models stay private to their owning module. Keep shared DTOs independent of Express, Mongoose, and Next.js.

| Module | Owns | Cross-module calls |
| --- | --- | --- |
| Auth | `users`, `sessions`, Admin verification and authorization | Exposes authenticated identity and guard to composition middleware |
| Doctor | `doctors`, unique email, doctor lookup and search, hospital/specialization facets | Exposes doctor existence/lookup to Patient. Its list read model may join Patient's collection through an explicit read-only aggregation dependency. |
| Patient | `patients`, normalized search fields, assignment and nested routes | Calls Doctor's public lookup before adding or reassigning. Owns nested handlers mounted by the central router. |
| Dashboard | Summary DTO, report calendar and read-only queries | Reads Doctor and Patient collections through a dedicated read repository. These projections and Doctor's patient-count join are deliberate read-side dependencies. |

The nested patient router uses `mergeParams: true` so it can validate the doctor `id` declared in its mount path. Place write rules in the Patient service so both route families use the same operations. Query dependencies remain one-way at the service level, with named collections isolated in read repositories and covered by integration tests.

## Data model and writes

| Collection | Stored data and invariants |
| --- | --- |
| `users` | Unique normalized email, display name, Argon2id password hash, `role: 'admin'`, account state, timestamps. Provision Admin through an explicit command. |
| `sessions` | Unique digest of an opaque session token, `userId`, `createdAt`, `expiresAt`. A TTL index on `expiresAt` with `expireAfterSeconds: 0` reclaims expired records. |
| `doctors` | Name, specialization, hospital, phone, canonical lowercase email, timestamps, and normalized search/sort fields. A unique email index is the source of truth for concurrent duplicates. |
| `patients` | Required `doctorId` reference, name, age, gender, phone, optional email, condition, status, optional notes, timestamps, and normalized search fields. Store IDs as BSON `ObjectId` and serialize to strings in REST responses. |

Keep patients in their own collection to support global filters and pagination. An admin can reassign a patient from the global edit workflow. V1 has no doctor delete, so an existence check followed by a single-document patient write is sufficient for current assignment rules. A future doctor deletion feature needs a coordinated relationship policy. A nested delete filters by both patient and doctor IDs in the delete operation. Patient deletion is permanent and is reflected in the next read of counts and charts. Derived patient counts avoid maintaining counters during writes and reassignment. [MongoDB TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)

## Authentication and request handling

Use an opaque, cryptographically random session token with a fixed 12-hour expiry for v1. Login verifies the Argon2id hash before creating a new session, stores only the token digest in MongoDB, and issues an `HttpOnly; Secure; SameSite=Lax; Path=/` host-only cookie (`__Host-doctor_tracker_session` over HTTPS). Use a separate unprefixed name on explicit local HTTP development. Check `expiresAt` and current account state on each authenticated request because MongoDB TTL deletion is asynchronous. Logout deletes the session and clears the cookie with matching name and path. Mongo-backed sessions provide immediate revocation and work across backend replicas at the cost of indexed session and user reads. [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet) · [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [MongoDB TTL timing](https://www.mongodb.com/docs/manual/core/index-ttl/#timing-of-the-delete-operation)

Express authorizes every protected endpoint. Use a generic `401` for bad credentials and comparable verification work for unknown accounts. Limit login attempts by trusted client IP and normalized account, with a shared limiter or gateway enforcement before scaling out. On every browser mutation, including login and logout, require the configured public origin via an exact `Origin` check or an exact origin derived from `Referer` when `Origin` is absent. Reject requests that provide neither trusted header. Require JSON on requests with mutation bodies and apply a body size limit. Keep the backend private behind the same-origin ingress where supported. Configure `trust proxy` for the actual trusted topology. [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · [Express behind proxies](https://expressjs.com/en/5x/guide/behind-proxies/)

Validate inputs into allow-listed query objects before creating MongoDB filters. Use the same error envelope for application errors, malformed JSON, and unknown API paths. Log request ID, route template, status, and duration. Keep cookies, credentials, bodies, patient search terms, and raw query strings out of application and ingress access logs. Mark protected responses `Cache-Control: private, no-store`. Keep secrets in the backend environment, use HTTPS and a least-privileged database identity, and use synthetic data for the evaluator deployment.

## List queries and indexes

Use one filter builder per resource for `find` and `countDocuments`. Use lean reads with explicit projections, and derive joins after pagination where the sort allows it. Append `_id` in the same direction as the main sort for deterministic ordering. Numbered pages can reach the full result set with up to 50 rows per page. Pages and totals are separate reads and can briefly differ during concurrent writes. Deep offsets still require scanning earlier results. [MongoDB ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/) · [MongoDB explain](https://www.mongodb.com/docs/manual/reference/method/cursor.explain/)

| Query shape | Starting index or approach |
| --- | --- |
| Both default lists and dashboard date reads | `{ createdAt: -1, _id: -1 }` on each collection |
| Doctor email uniqueness | `{ email: 1 }`, unique |
| Doctor specialization or hospital + default sort | One `{ facetKey: 1, createdAt: -1, _id: -1 }` index per facet key. Use normalized keys and return display labels from the metadata endpoint. |
| Patient list under a doctor, with or without condition | `{ doctorId: 1, createdAt: -1, _id: -1 }` and `{ doctorId: 1, condition: 1, createdAt: -1, _id: -1 }` |
| Global patient condition or status + default sort | `{ condition: 1, createdAt: -1, _id: -1 }` and `{ status: 1, createdAt: -1, _id: -1 }` |
| Doctor and patient search | Doctor text search uses case-insensitive prefixes. Patient name and email search use lowercased, escaped prefixes on indexed `nameSearch` and `email` fields. Both searches normalize phone inputs to digits and query `phoneSearch`. Verify `$or` plans and blocking sorts with realistic terms. |
| Doctor list or detail with counts | For default doctor pages, group patient counts for visible doctor IDs with one read. For `sort=patients.*`, match doctors first, aggregate counts before sort and page, and treat this as a separately measured query path. Include doctors with zero patients. |
| Patient list with doctor names | Batch-fetch names for the doctor IDs on the page via the public lookup or a projected join. |

The default, single-facet, and scoped list paths are the main index targets. Multi-facet `$in`, prefix search combined with chronological sort, and derived count sorts can require different plans. Check `totalKeysExamined`, `totalDocsExamined`, and sort stages for common workloads before adding compound indexes. Install named indexes through an explicit release step. [MongoDB regex index use](https://www.mongodb.com/docs/manual/reference/operator/query/regex/#index-use) · [MongoDB ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/)

## Dashboard reads

Return one HTTP summary built from four MongoDB reads in parallel, with capped result sizes. The range selector changes patient trends and the current/prior new-patient counts. Every other dataset uses all currently stored records.

1. **Doctors:** Aggregate all-time total and counts by specialization. Group on the canonical specialization key and return a display label. Bound the chart output and fold the tail into an aggregate bucket if needed.
2. **Patients:** Use a `$facet` over projected all-time patient data for total, counts by condition, and top eight doctors. Group and limit before looking up doctor names.
3. **Patient date window:** Use an indexed `$match` spanning the current and previous windows. Aggregate counts and date buckets, and zero-fill the current window in the service. Store timestamps in UTC and bucket in `REPORTING_TIME_ZONE`, initially `Asia/Dhaka`.
4. **Recent patients:** Read the five newest patients using the default descending index and join only their doctor names. Project the fields listed in the contract.

Keep the dashboard outputs bounded and verify scans and latency. A date match before the all-time facets would change their totals. The all-time summary reads can reflect slightly different instants during a concurrent write. The UI uses a 60-second freshness window and invalidates after writes. Start with live aggregations and evaluate a materialized rollup only if measurements show that repeated aggregation is the bottleneck. [MongoDB `$facet` limits and index behavior](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/#considerations) · [MongoDB `$dateTrunc`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/datetrunc/)

## Deployment and configuration

Use `MONGODB_URI`, `PORT`, `TRUST_PROXY_HOPS`, `NODE_ENV`, `PUBLIC_APP_ORIGIN`, and `REPORTING_TIME_ZONE` for the backend. Set `TRUST_PROXY_HOPS` to the number of trusted reverse proxy hops in the deployed topology. Use `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` for explicit provisioning only. Use a server-only `BACKEND_ORIGIN` for the frontend rewrite and server calls. The release target must support a long-running Express process and the Next.js server with the same browser-visible origin.

Expose shallow `/health/live` and `/health/ready` endpoints to the platform. Readiness checks MongoDB connectivity. Verify `Set-Cookie`, forwarded cookies, request origins, no-store headers, and the login limiter through the deployed ingress. Monitor API latency, MongoDB query latency, 5xx rates, and login throttling. Add API replicas if request load warrants it and size the total MongoDB connection budget across replicas.
