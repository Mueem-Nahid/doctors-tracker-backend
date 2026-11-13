import assert from "node:assert/strict";
import { test } from "node:test";

const testUri = process.env.MONGODB_TEST_URI;

test(
  "authenticated doctor, patient, and dashboard API workflow",
  { skip: !testUri && "Set MONGODB_TEST_URI to an isolated doctor_tracker_test database" },
  async () => {
    assert.ok(testUri);
    const databaseName = decodeURIComponent(new URL(testUri).pathname.slice(1).split("/")[0] ?? "");
    assert.equal(
      databaseName,
      "doctor_tracker_test",
      "Integration tests only run against the dedicated doctor_tracker_test database",
    );

    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = testUri;
    process.env.PORT = "4000";
    process.env.TRUST_PROXY_HOPS = "0";
    process.env.PUBLIC_APP_ORIGIN = "http://localhost:3000";
    process.env.REPORTING_TIME_ZONE = "Asia/Dhaka";

    const [
      { default: mongoose },
      { app },
      { UserModel },
      { DoctorModel },
      { PatientModel },
      { SessionModel },
      { default: argon2 },
    ] = await Promise.all([
      import("mongoose"),
      import("../../src/app.js"),
      import("../../src/app/modules/auth/user.model.js"),
      import("../../src/app/modules/doctors/doctor.model.js"),
      import("../../src/app/modules/patients/patient.model.js"),
      import("../../src/app/modules/auth/session.model.js"),
      import("argon2"),
    ]);

    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
    await Promise.all([
      UserModel.init(),
      DoctorModel.init(),
      PatientModel.init(),
      SessionModel.init(),
    ]);
    await UserModel.create({
      email: "phase6-admin@example.test",
      name: "Phase 6 Admin",
      passwordHash: await argon2.hash("test-password-phase6"),
      role: "admin",
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };

    try {
      const unauthenticatedDoctors = await fetch(`${base}/doctors`);
      assert.equal(unauthenticatedDoctors.status, 401);
      const invalidLogin = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "phase6-admin@example.test", password: "wrong-password" }),
      });
      assert.equal(invalidLogin.status, 401);
      assert.equal(
        ((await invalidLogin.json()) as { error: { code: string } }).error.code,
        "INVALID_CREDENTIALS",
      );
      const login = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "phase6-admin@example.test",
          password: "test-password-phase6",
        }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie);
      const authHeaders = { ...headers, cookie };

      const doctorResponse = await fetch(`${base}/doctors`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "Dr. Phase Six",
          specialization: "Cardiology",
          hospital: "Test Hospital",
          phone: "+880170000006",
          email: "doctor-phase6@example.test",
        }),
      });
      assert.equal(doctorResponse.status, 201);
      const doctor = ((await doctorResponse.json()) as { data: { _id: string } }).data;
      const duplicateDoctor = await fetch(`${base}/doctors`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "Dr. Duplicate",
          specialization: "Cardiology",
          hospital: "Test Hospital",
          phone: "+880170000008",
          email: "doctor-phase6@example.test",
        }),
      });
      assert.equal(duplicateDoctor.status, 409);
      const secondDoctorResponse = await fetch(`${base}/doctors`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "Dr. Other",
          specialization: "Neurology",
          hospital: "Test Hospital",
          phone: "+880170000007",
          email: "other-phase6@example.test",
        }),
      });
      assert.equal(secondDoctorResponse.status, 201);
      const secondDoctor = ((await secondDoctorResponse.json()) as { data: { _id: string } }).data;
      const competingDoctors = await Promise.all(
        [1, 2].map((index) =>
          fetch(`${base}/doctors`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              name: `Dr. Concurrent ${index}`,
              specialization: "Pediatrics",
              hospital: "Test Hospital",
              phone: `+88017000000${index}`,
              email: "concurrent-phase6@example.test",
            }),
          }),
        ),
      );
      assert.deepEqual(competingDoctors.map((response) => response.status).sort(), [201, 409]);

      const createResponse = await fetch(`${base}/patients`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          doctorId: doctor._id,
          name: "Test Patient",
          age: 40,
          gender: "female",
          phone: "+880180000006",
          email: "patient@example.test",
          condition: "Diabetes",
          status: "Active",
          notes: "Private note",
        }),
      });
      assert.equal(createResponse.status, 201);
      const patient = ((await createResponse.json()) as { data: { _id: string } }).data;
      const listResponse = await fetch(
        `${base}/patients?doctorId=${doctor._id}&condition=Diabetes&status=Active`,
        { headers: authHeaders },
      );
      assert.equal(listResponse.status, 200);
      const list = ((await listResponse.json()) as { data: Array<Record<string, unknown>> }).data;
      assert.equal(list.length, 1);
      assert.equal("notes" in list[0]!, false, "List rows must not include notes");

      const wrongScopeDelete = await fetch(
        `${base}/doctors/${secondDoctor._id}/patients/${patient._id}`,
        { method: "DELETE", headers: authHeaders },
      );
      assert.equal(wrongScopeDelete.status, 404);
      const editResponse = await fetch(`${base}/patients/${patient._id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ doctorId: secondDoctor._id, notes: null, email: null }),
      });
      assert.equal(editResponse.status, 200);
      const edited = (
        (await editResponse.json()) as {
          data: { doctorId: string; notes?: string; email?: string };
        }
      ).data;
      assert.equal(edited.doctorId, secondDoctor._id);
      assert.equal("notes" in edited, false);
      assert.equal("email" in edited, false);

      const summaryResponse = await fetch(`${base}/dashboard/summary?range=7d`, {
        headers: authHeaders,
      });
      assert.equal(summaryResponse.status, 200);
      const summary = (
        (await summaryResponse.json()) as {
          data: {
            kpis: {
              totalDoctors: number;
              totalPatients: number;
              newPatients: { value: number };
              avgPatientsPerDoctor: number;
            };
            patientsOverTime: Array<{ date: string; count: number }>;
            recentPatients: Array<{ _id: string }>;
          };
        }
      ).data;
      assert.equal(summary.kpis.totalDoctors, 3);
      assert.equal(summary.kpis.totalPatients, 1);
      assert.equal(summary.kpis.newPatients.value, 1);
      assert.equal(summary.kpis.avgPatientsPerDoctor, 0.33);
      assert.equal(summary.patientsOverTime.length, 7);
      assert.equal(
        summary.patientsOverTime.reduce((sum, point) => sum + point.count, 0),
        1,
      );
      assert.equal(summary.recentPatients[0]?._id, patient._id);

      const deleteResponse = await fetch(`${base}/patients/${patient._id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      assert.equal(deleteResponse.status, 204);
      const finalPage = await fetch(`${base}/patients?page=1&pageSize=10`, {
        headers: authHeaders,
      });
      assert.equal(((await finalPage.json()) as { data: unknown[] }).data.length, 0);
      const logout = await fetch(`${base}/auth/logout`, { method: "POST", headers: authHeaders });
      assert.equal(logout.status, 204);
      const revokedSession = await fetch(`${base}/doctors`, { headers: authHeaders });
      assert.equal(revokedSession.status, 401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
