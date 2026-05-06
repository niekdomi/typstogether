const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

export function formatRelative(value: Date | string): string {
  const time = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  const diff = (time - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < MIN) return relativeFmt.format(Math.round(diff), "second");
  if (abs < HOUR) return relativeFmt.format(Math.round(diff / MIN), "minute");
  if (abs < DAY) return relativeFmt.format(Math.round(diff / HOUR), "hour");
  if (abs < MONTH) return relativeFmt.format(Math.round(diff / DAY), "day");
  if (abs < YEAR) return relativeFmt.format(Math.round(diff / MONTH), "month");
  return relativeFmt.format(Math.round(diff / YEAR), "year");
}

export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
