// Plain local calendar dates as `YYYY-MM-DD` strings. Pure functions, no React.
//
// All date maths runs on year/month/day numbers through a day count (days since 1970-01-01 in the
// proleptic Gregorian calendar), never through `Date` timestamps, so there is no off-by-one around
// midnight, time zones or DST. `Date` is only used to read "today" and to format names with `Intl`.

/** A calendar day, `YYYY-MM-DD`. */
export type DateKey = string;
/** A calendar month, `YYYY-MM`. */
export type MonthKey = string;

export interface Ymd {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

/** Day of the week, 0 = Sunday … 6 = Saturday (like `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** `{ year, month, day }` of a valid date key, otherwise null (also for e.g. `2026-02-30`). */
export function parseDate(key: string): Ymd | null {
  const m = DATE_RE.exec(key);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isDateKey(value: string): boolean {
  return parseDate(value) !== null;
}

export function toDateKey({ year, month, day }: Ymd): DateKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function mustParse(key: DateKey): Ymd {
  const ymd = parseDate(key);
  if (!ymd) throw new RangeError(`Not a date: ${key}`);
  return ymd;
}

// Howard Hinnant's days_from_civil / civil_from_days.
function toDayNumber({ year, month, day }: Ymd): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDayNumber(n: number): Ymd {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** The local calendar date of `now` (default: the current moment). */
export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

export function addDays(key: DateKey, days: number): DateKey {
  return toDateKey(fromDayNumber(toDayNumber(mustParse(key)) + days));
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return toDayNumber(mustParse(b)) - toDayNumber(mustParse(a));
}

export function weekday(key: DateKey): Weekday {
  // 1970-01-01 was a Thursday.
  return ((((toDayNumber(mustParse(key)) + 4) % 7) + 7) % 7) as Weekday;
}

/** The first day of the week containing `key`, for weeks starting on `firstDay`. */
export function startOfWeek(key: DateKey, firstDay: Weekday): DateKey {
  return addDays(key, -((weekday(key) - firstDay + 7) % 7));
}

/** `count` consecutive days starting at `start`. */
export function daysFrom(start: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** The seven days of the week containing `key`. */
export function weekOf(key: DateKey, firstDay: Weekday): DateKey[] {
  return daysFrom(startOfWeek(key, firstDay), 7);
}

export function monthOf(key: DateKey): MonthKey {
  return key.slice(0, 7);
}

export function parseMonth(month: string): { year: number; month: number } | null {
  const m = MONTH_RE.exec(month);
  if (!m) return null;
  const value = { year: Number(m[1]), month: Number(m[2]) };
  return value.month >= 1 && value.month <= 12 ? value : null;
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const parsed = parseMonth(month);
  if (!parsed) throw new RangeError(`Not a month: ${month}`);
  const index = parsed.year * 12 + (parsed.month - 1) + n;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/** The same day of month `n` months later, clamped to the month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonthsToDate(key: DateKey, n: number): DateKey {
  const { day } = mustParse(key);
  const month = parseMonth(addMonths(monthOf(key), n))!;
  return toDateKey({ ...month, day: Math.min(day, daysInMonth(month.year, month.month)) });
}

export function firstOfMonth(month: MonthKey): DateKey {
  return `${month}-01`;
}

/** Every month from the month of `from` to the month of `to`, inclusive. */
export function monthsBetween(from: DateKey, to: DateKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let m = monthOf(from); m <= monthOf(to); m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Full weeks covering `month`, as rows of seven date keys (days of the neighbour months included). */
export function monthGrid(month: MonthKey, firstDay: Weekday): DateKey[][] {
  const first = firstOfMonth(month);
  const last = addDays(firstOfMonth(addMonths(month, 1)), -1);
  const rows: DateKey[][] = [];
  for (let start = startOfWeek(first, firstDay); start <= last; start = addDays(start, 7)) {
    rows.push(daysFrom(start, 7));
  }
  return rows;
}

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay?: number };
  weekInfo?: { firstDay?: number };
}

/**
 * First day of the week for a locale (`Intl.Locale` week info, where the runtime has it), Monday otherwise.
 * Week info numbers days 1 = Monday … 7 = Sunday.
 */
export function firstDayOfWeek(locale: string): Weekday {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & WeekInfoLocale;
    const firstDay = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
    if (typeof firstDay === 'number' && firstDay >= 1 && firstDay <= 7) return (firstDay % 7) as Weekday;
  } catch {
    // unknown locale tag: fall back
  }
  return 1;
}

/** A local `Date` for formatting a key with `Intl` (noon, so no zone shift can change the day). */
export function dateForFormat(key: DateKey): Date {
  const { year, month, day } = mustParse(key);
  const date = new Date(2000, month - 1, day, 12);
  date.setFullYear(year);
  return date;
}
