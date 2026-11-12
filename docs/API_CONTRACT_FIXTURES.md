# API contract fixtures

These fixtures are shared review examples for frontend and backend work. Dynamic timestamps and record IDs use fixed example values. Resource IDs are BSON ObjectId strings.

## Empty dashboard

Request: `GET /api/dashboard/summary?range=30d`

```json
{
  "kpis": {
    "totalDoctors": 0,
    "totalPatients": 0,
    "avgPatientsPerDoctor": 0,
    "newPatients": { "value": 0, "previous": 0, "deltaPct": null }
  },
  "patientsOverTime": [],
  "patientsByCondition": [],
  "patientsPerDoctor": [],
  "doctorsBySpecialization": [],
  "recentPatients": []
}
```

No doctors means average patients per doctor is `0`. A zero previous period means `deltaPct` is `null`.

## Populated patient page

Request: `GET /api/patients?page=2&pageSize=1&sort=createdAt.desc`

```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "doctorId": "507f1f77bcf86cd799439011",
      "doctorName": "Dr. A. Rahman",
      "name": "Sara Khan",
      "age": 38,
      "gender": "female",
      "phone": "+880 1712 345678",
      "email": "sara@example.test",
      "condition": "Diabetes",
      "status": "Active",
      "createdAt": "2026-11-11T18:20:00.000Z",
      "updatedAt": "2026-11-11T18:20:00.000Z"
    }
  ],
  "meta": { "page": 2, "pageSize": 1, "total": 3, "pageCount": 3 }
}
```

List rows omit notes. The `total` reflects all filters and the page uses a deterministic `_id` tie-breaker when timestamps are equal. See [the full REST contract](API_CONTRACT.md) for field validation and error behavior.
