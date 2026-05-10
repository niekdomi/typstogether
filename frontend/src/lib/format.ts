const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const SEC = 1;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const UNITS = [
  { max: MIN, divisor: SEC, unit: "second" },
  { max: HOUR, divisor: MIN, unit: "minute" },
  { max: DAY, divisor: HOUR, unit: "hour" },
  { max: MONTH, divisor: DAY, unit: "day" },
  { max: YEAR, divisor: MONTH, unit: "month" },
  { max: Infinity, divisor: YEAR, unit: "year" },
] as const;

export function formatRelative(value: Date | string): string {
  const time = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  const diff = (time - Date.now()) / 1000;
  const abs = Math.abs(diff);

  const config = UNITS.find((u) => abs < u.max) ?? UNITS.at(-1)!;

  return relativeFmt.format(
    Math.round(diff / config.divisor),
    config.unit as Intl.RelativeTimeFormatUnit
  );
}

export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function userInitial(name: string | undefined): string {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}
