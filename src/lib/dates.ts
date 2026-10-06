import { addDays as addD, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// All "calendar" dates in Diva are plain yyyy-MM-dd strings interpreted in the
// user's configured timezone. Instants (timestamps) are ISO strings in UTC.

export const todayIn = (tz: string, now: Date = new Date()) => formatInTimeZone(now, tz, "yyyy-MM-dd");
export const nowTimeIn = (tz: string, now: Date = new Date()) => formatInTimeZone(now, tz, "HH:mm");

export const addDays = (date: string, n: number) => format(addD(parseISO(date), n), "yyyy-MM-dd");
export const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from));

/** Local date + optional HH:mm in tz -> UTC Date */
export const zonedToUtc = (date: string, time: string | null | undefined, tz: string) =>
  fromZonedTime(`${date}T${time || "00:00"}:00`, tz);

export const dateInTz = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd");

export const monthKey = (date: string) => date.slice(0, 7); // yyyy-MM

export function monthMatrix(month: string /* yyyy-MM */) {
  const first = parseISO(`${month}-01`);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const start = addD(first, -startOffset);
  return Array.from({ length: 42 }, (_, i) => format(addD(start, i), "yyyy-MM-dd"));
}

export const shiftMonth = (month: string, n: number) => {
  const d = parseISO(`${month}-01`);
  return format(new Date(d.getFullYear(), d.getMonth() + n, 1), "yyyy-MM");
};

export const fmt = {
  day: (d: string) => format(parseISO(d), "d MMM"),
  dayLong: (d: string) => format(parseISO(d), "EEEE, d MMMM"),
  dayWithYear: (d: string) => format(parseISO(d), "d MMM yyyy"),
  weekdayShort: (d: string) => format(parseISO(d), "EEE d MMM"),
  month: (m: string) => format(parseISO(`${m}-01`), "MMMM yyyy"),
  time: (t: string | null | undefined) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    const hh = h % 12 || 12;
    return m ? `${hh}:${String(m).padStart(2, "0")}${ampm}` : `${hh}${ampm}`;
  },
  instant: (iso: string | null | undefined, tz: string) =>
    iso ? formatInTimeZone(new Date(iso), tz, "d MMM, h:mm a") : "—",
};

/** Human relative label: "Today", "Tomorrow", "in 3 days", "2 days ago" */
export function relativeDay(date: string, today: string) {
  const d = daysBetween(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return `in ${d} days`;
  if (d < -1) return `${-d} days ago`;
  return fmt.day(date);
}
