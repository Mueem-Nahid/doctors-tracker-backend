const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function toUtcBoundary(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  const formatter = dateFormatterCache.get(timeZone) ?? new Intl.DateTimeFormat("en-US", {
    timeZone, calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  dateFormatterCache.set(timeZone, formatter);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]));
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    candidate += target - localAsUtc;
  }
  return new Date(candidate);
}

export function buildCreatedAtRange(from: string | undefined, to: string | undefined, timeZone: string) {
  const range: { $gte?: Date; $lt?: Date } = {};
  if (from) range.$gte = toUtcBoundary(from, timeZone);
  if (to) {
    const [year, month, day] = to.split("-").map(Number);
    range.$lt = toUtcBoundary(new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10), timeZone);
  }
  return range;
}

export function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
export function toPhoneDigits(value: string): string { return value.replace(/\D/g, ""); }
export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, pageCount: Math.ceil(total / pageSize) };
}
