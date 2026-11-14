# Doctor Tracker REST API contract

[Backend architecture](ARCHITECTURE.md) · [Frontend implementation plan](https://github.com/Mueem-Nahid/doctors-tracker-frontend/blob/main/docs/IMPLEMENTATION_PLAN.md)

Browser requests use `/api`. The same-origin rewrite maps each suffix to Express at `/api/v1`. The `me` route and all resource endpoints require a valid Admin session. Express accepts JSON for requests with bodies. Browser mutations must pass the origin check, including bodyless logout and delete.

## Routes

| Method and browser path | Success | Behavior |
| --- | --- | --- |
| `POST /api/auth/login` | `200 { data: Admin }` | Accepts `email` and `password`. Sets the session cookie. Wrong credentials return a generic `401 INVALID_CREDENTIALS`. |
| `GET /api/auth/me` | `200 { data: Admin }` | Validates the current session and role. |
| `POST /api/auth/logout` | `204` | Revokes the current session and clears its cookie. Idempotent for a missing or expired session. |
| `GET /api/doctors` | `200 Page<Doctor>` | Supports doctor search, filters and sort. The same list feeds the doctor combobox. |
| `POST /api/doctors` | `201 { data: Doctor }` | Creates a doctor with `patientCount: 0`. Duplicate normalized email returns `409` with `fields.email`. |
| `GET /api/doctors/:id` | `200 { data: Doctor }` | Includes current `patientCount`. |
| `GET /api/doctors/:id/patients` | `200 Page<PatientRow>` | Uses patient list filters with the doctor scope taken from the path. Existing doctor with zero matches returns an empty page. |
| `POST /api/doctors/:id/patients` | `201 { data: PatientDetail }` | Creates under the doctor in the path. The body omits `doctorId`. |
| `DELETE /api/doctors/:id/patients/:patientId` | `204` | Permanently deletes the patient only if currently assigned to the doctor in the path. |
| `GET /api/patients` | `200 Page<PatientRow>` | Lists patients across doctors. |
| `POST /api/patients` | `201 { data: PatientDetail }` | Creates a patient under an existing `doctorId` from the body. |
| `GET /api/patients/:id` | `200 { data: PatientDetail }` | Loads the current patient and optional notes when opening the edit sheet. |
| `PATCH /api/patients/:id` | `200 { data: PatientDetail }` | Accepts an allow-listed partial update with at least one field. A supplied `doctorId` must exist. |
| `DELETE /api/patients/:id` | `204` | Permanently deletes the patient. |
| `GET /api/meta/filters` | `200 { data: FilterOptions }` | Returns `{ specializations: string[], hospitals: string[] }`, sorted with one display label per normalized value. |
| `GET /api/dashboard/summary` | `200 DashboardSummary` | Accepts `range=7d`, `30d` (default), `90d`, or `12m`. |

`Admin` contains `_id`, `name`, `email`, and `role: 'admin'`. Record IDs are strings containing MongoDB ObjectIds. `Doctor` contains `_id`, `name`, `specialization`, `hospital`, `phone`, `email`, `createdAt`, `updatedAt`, and `patientCount`. `PatientRow` contains `_id`, `doctorId`, `doctorName`, `name`, `age`, `gender`, `phone`, `email` when present, `condition`, `status`, `createdAt`, and `updatedAt`. `PatientDetail` adds `notes` when present. Dates in resource DTOs are ISO 8601 UTC timestamps.

## Input and list behavior

- **Doctor create:** `name`, `specialization`, `hospital`, `phone`, and `email` are required. Trim strings, normalize email, preserve display names and phone formatting, and set timestamps server-side.
- **Patient create:** `name`, integer `age` from 0 to 120, `gender`, `phone`, and `condition` are required. `email` and `notes` are optional. `status` defaults to `Active`. Global create also requires `doctorId`. Use genders `male`, `female`, `other`, and statuses `Active`, `Under observation`, `Discharged`. Use the condition enum in [design §8.5](https://github.com/Mueem-Nahid/doctors-tracker-frontend/blob/main/docs/DESIGN.md#85-patients-patients). Bound `notes` to 500 characters. `PATCH` accepts `null` to clear `email` or `notes`. Omitted fields retain their value. Apply input length limits in shared schemas and recompute normalized search values when source fields change.
- **Common list params.** `q`, `page` (default `1`), `pageSize` (default `10`, max `50`), `sort` (default `createdAt.desc`), `from`, and `to`. Page and size must be positive integers. Accept `field.asc` or `field.desc`. Doctors support `name`, `specialization`, `hospital`, `patients`, `createdAt`. Patients support `name`, `age`, `condition`, `status`, `createdAt`. Add `_id` as a stable tie-breaker. Return an empty `data` array for a valid page beyond the current result set.
- **Search:** `q` matches a literal case-insensitive prefix of doctor name, hospital, email, or phone, and patient name, email, or phone. Normalize both search and stored values. A phone-shaped query uses the digits-only prefix. Use a trimmed maximum of 100 characters and treat a blank search as omitted.
- **Facets:** Doctors accept `specialization` and `hospital`. Patients accept `condition`, `status`, and, on the global list, `doctorId`. The nested list rejects a query-string `doctorId` so the URL path is the sole scope. Serialize multiple values as a comma-delimited value for enum/ID facets. Serialize free-text hospital and specialization selections as repeated keys so names containing commas survive round trips. Use OR within each facet and AND between facets. Cap at 10 selections per facet. Match free-text facets on normalized equality.
- **Dates:** `from` and `to` are inclusive reporting dates (`YYYY-MM-DD`) on `createdAt`. Convert them to a UTC interval from the start of `from` through the start of the day after `to`, using `REPORTING_TIME_ZONE`. Either bound can be omitted. Validate calendar dates and reject a reversed range. No separate admission date is required for v1.
- **Validation:** Reject unsupported keys, conflicting nested scopes, and invalid filter IDs with `422`. A malformed resource ID in the path or a missing resource returns `404`. A valid but unknown `doctorId` in a create or edit body returns `422` with `fields.doctorId`. A scoped delete with no match returns `404`.

```json
{
  "data": {
    "data": [],
    "meta": { "page": 1, "pageSize": 10, "total": 0, "pageCount": 0 }
  }
}
```

`total` is the count after all filters. `pageCount` is `ceil(total / pageSize)`. A single-record read or write returns `{ data: ... }`. A `204` response has an empty body.

## Dashboard response and date rules

```json
{
  "kpis": {
    "totalDoctors": 42,
    "totalPatients": 1280,
    "avgPatientsPerDoctor": 30.48,
    "newPatients": { "value": 96, "previous": 80, "deltaPct": 20 }
  },
  "patientsOverTime": [{ "date": "2026-10-14", "count": 4 }],
  "patientsByCondition": [{ "condition": "Diabetes", "count": 210 }],
  "patientsPerDoctor": [{ "doctorId": "507f1f77bcf86cd799439011", "name": "Dr. A. Rahman", "count": 42 }],
  "doctorsBySpecialization": [{ "specialization": "Cardiology", "count": 9 }],
  "recentPatients": [{ "_id": "507f1f77bcf86cd799439012", "name": "Sara Khan", "doctorId": "507f1f77bcf86cd799439011", "doctorName": "Dr. A. Rahman", "condition": "Diabetes", "status": "Active", "createdAt": "2026-11-12T05:35:00.000Z" }]
}
```

- **Windows:** `7d`, `30d`, and `90d` include today and the preceding 6, 29, or 89 reporting dates. `12m` includes the current calendar month to date and the preceding 11 months. Compare with the immediately preceding adjacent window of the same number of days or calendar months. Capture `now` once per response and exclude timestamps later than `now` from the current window. Use daily buckets for 7/30 days, Monday-start weekly buckets for 90 days, and monthly buckets for 12 months. Return ascending local bucket-start dates and zero-fill all buckets that intersect the current window.
- **KPIs:** Totals and workload averages include all current records. Average is `0` with no doctors. `deltaPct` is `null` when `previous` is `0`; the UI displays the absolute current count without a percentage change.
- **Chart and recent limits:** Return five conditions plus a tail bucket when needed, eight doctors with the highest positive counts, up to ten specializations plus a tail bucket when needed, and five recent patients by `createdAt.desc` with `_id` as a tie-breaker. Resolve equal group counts deterministically by category key or doctor ID. A tail bucket includes `isGrouped: true` and the label `Other conditions` or `Other specializations`. The literal patient condition `Other` remains eligible as its own category. Grouped condition buckets have no single-condition drilldown. The recent rows omit contact fields and notes.

## Errors

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "A doctor with this email already exists",
    "fields": { "email": "Email already in use" }
  }
}
```

| Status | Code | Applies to |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | Malformed JSON |
| `401` | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Missing/expired session or failed login, respectively |
| `403` | `FORBIDDEN` | Insufficient role or rejected request origin |
| `404` | `NOT_FOUND` | Missing resource, wrong nested scope, or unknown API path |
| `409` | `CONFLICT` | Duplicate doctor email |
| `413` | `PAYLOAD_TOO_LARGE` | Body exceeds the configured limit |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Body is sent with an unsupported media type |
| `422` | `VALIDATION_ERROR` | Query or body validation failed |
| `429` | `RATE_LIMITED` | Login limit reached, with `Retry-After` where available |
| `500` | `INTERNAL` | Unexpected server error |

`error.fields` is optional and maps field names to actionable messages. Return an `X-Request-Id` for diagnostics and protect sensitive payloads from HTTP caching. Follow [the architecture's request handling rules](ARCHITECTURE.md#authentication-and-request-handling).
