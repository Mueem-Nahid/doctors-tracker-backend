import assert from "node:assert/strict";
import { test } from "node:test";
import {
  doctorListQuerySchema,
  globalPatientListQuerySchema,
  patientListQuerySchema,
} from "@doctor-tracker/contracts";
import { pageMeta } from "../../src/shared/queryUtils.js";

test("all advertised demo patient pages pass request validation", () => {
  for (const pageSize of [10, 20, 50]) {
    const { pageCount } = pageMeta(1, pageSize, 30_000);
    const query = globalPatientListQuerySchema.parse({ page: pageCount, pageSize });
    assert.equal(query.page, pageCount);
  }
});

test("expanded pagination still rejects invalid page, page size, and date ranges", () => {
  for (const schema of [
    doctorListQuerySchema,
    patientListQuerySchema,
    globalPatientListQuerySchema,
  ]) {
    assert.equal(schema.safeParse({ page: 0 }).success, false);
    assert.equal(schema.safeParse({ pageSize: 51 }).success, false);
    assert.equal(schema.safeParse({ from: "2026-11-14", to: "2026-11-13" }).success, false);
  }
});
