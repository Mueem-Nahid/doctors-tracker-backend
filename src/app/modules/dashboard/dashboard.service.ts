import type { DashboardSummary, ReportingRange } from "@doctor-tracker/contracts";
import { config } from "../../../config/index.js";
import { DashboardRepository } from "./dashboard.repository.js";

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}
function dateInZone(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    dateFormatter(timeZone)
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function shiftDays(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + amount)).toISOString().slice(0, 10);
}
function monthStartOffset(date: string, amount: number) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1 + amount, 1)).toISOString().slice(0, 10);
}
function utcBoundary(localDate: string, timeZone: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    candidate += target - localAsUtc;
  }
  return new Date(candidate);
}

function windowFor(range: ReportingRange, now: Date, timeZone: string) {
  const today = dateInZone(now, timeZone);
  if (range === "12m") {
    const currentFromDate = monthStartOffset(today, -11);
    const previousFromDate = monthStartOffset(currentFromDate, -12);
    return {
      from: utcBoundary(previousFromDate, timeZone),
      currentFrom: utcBoundary(currentFromDate, timeZone),
      currentFromDate,
      today,
      unit: "month" as const,
    };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const currentFromDate = shiftDays(today, -(days - 1));
  const previousFromDate = shiftDays(currentFromDate, -days);
  return {
    from: utcBoundary(previousFromDate, timeZone),
    currentFrom: utcBoundary(currentFromDate, timeZone),
    currentFromDate,
    today,
    unit: range === "90d" ? ("week" as const) : ("day" as const),
  };
}

function bucketDates(startDate: string, today: string, unit: "day" | "week" | "month") {
  if (unit === "month") {
    const months: string[] = [];
    for (let date = startDate; date <= today; date = monthStartOffset(date, 1)) months.push(date);
    return months;
  }
  if (unit === "week") {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const weekday = (start.getUTCDay() + 6) % 7;
    let date = shiftDays(startDate, -weekday);
    const end = new Date(`${today}T00:00:00.000Z`);
    const result: string[] = [];
    while (new Date(`${date}T00:00:00.000Z`) <= end) {
      result.push(date);
      date = shiftDays(date, 7);
    }
    return result;
  }
  const result: string[] = [];
  for (let date = startDate; date <= today; date = shiftDays(date, 1)) result.push(date);
  return result;
}

async function summary(range: ReportingRange): Promise<DashboardSummary> {
  const now = new Date();
  const window = windowFor(range, now, config.REPORTING_TIME_ZONE);
  const [doctors, patients, timeData, recent] = await Promise.all([
    DashboardRepository.doctorsSummary(),
    DashboardRepository.patientsSummary(),
    DashboardRepository.patientWindows(
      window.from,
      window.currentFrom,
      now,
      config.REPORTING_TIME_ZONE,
      window.unit,
    ),
    DashboardRepository.recentPatients(),
  ]);
  const totalDoctors = doctors.total[0]?.value ?? 0;
  const totalPatients = patients.total[0]?.value ?? 0;
  const counts = timeData.counts[0] ?? { current: 0, previous: 0 };
  const conditionRows = patients.conditions.map(({ _id, count }) => ({ condition: _id, count }));
  const patientsByCondition =
    conditionRows.length > 5
      ? [
          ...conditionRows.slice(0, 5),
          {
            condition: "Other conditions",
            count: conditionRows.slice(5).reduce((sum, row) => sum + row.count, 0),
            isGrouped: true,
          },
        ]
      : conditionRows;
  const specializationRows = doctors.specializations.map(({ label, count }) => ({
    specialization: label,
    count,
  }));
  const otherSpecializationCount = Math.max(
    0,
    totalDoctors - specializationRows.reduce((sum, row) => sum + row.count, 0),
  );
  const doctorsBySpecialization = otherSpecializationCount
    ? [
        ...specializationRows,
        {
          specialization: "Other specializations",
          count: otherSpecializationCount,
          isGrouped: true,
        },
      ]
    : specializationRows;
  const bucketCounts = new Map(
    timeData.buckets.map(({ _id, count }) => [
      dateInZone(new Date(_id), config.REPORTING_TIME_ZONE),
      count,
    ]),
  );
  const patientsOverTime = bucketDates(window.currentFromDate, window.today, window.unit)
    .map((date) => {
      const bucketDate =
        window.unit === "week"
          ? shiftDays(date, -((new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7))
          : date;
      return { date: bucketDate, count: bucketCounts.get(bucketDate) ?? 0 };
    })
    .filter((point, index, series) => index === 0 || point.date !== series[index - 1]!.date);
  return {
    kpis: {
      totalDoctors,
      totalPatients,
      avgPatientsPerDoctor: totalDoctors
        ? Math.round((totalPatients / totalDoctors) * 100) / 100
        : 0,
      newPatients: {
        value: counts.current,
        previous: counts.previous,
        deltaPct: counts.previous
          ? Math.round(((counts.current - counts.previous) / counts.previous) * 10_000) / 100
          : null,
      },
    },
    patientsOverTime,
    patientsByCondition,
    patientsPerDoctor: patients.doctors.map((doctor) => ({
      doctorId: doctor._id.toString(),
      name: doctor.name,
      count: doctor.count,
    })),
    doctorsBySpecialization,
    recentPatients: recent.map((patient) => ({
      _id: patient._id.toString(),
      name: patient.name,
      doctorId: patient.doctorId.toString(),
      doctorName: patient.doctorName,
      condition: patient.condition as DashboardSummary["recentPatients"][number]["condition"],
      status: patient.status as DashboardSummary["recentPatients"][number]["status"],
      createdAt: patient.createdAt.toISOString(),
    })),
  };
}

export const DashboardService = { summary };
