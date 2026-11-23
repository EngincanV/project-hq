// Locale-aware names for days and months (through Intl, in the active UI language) and today's date.
import { useEffect, useMemo, useState } from 'react';
import { useLang, type Lang } from '../../i18n';
import { dateForFormat, firstDayOfWeek, firstOfMonth, todayKey, type DateKey, type MonthKey, type Weekday } from './dates';

/**
 * The locale used for the calendar: the browser's own tag when it is in the UI language (so an `en-GB`
 * browser gets Monday weeks and day-month order), otherwise the bare language.
 */
export function calendarLocale(lang: Lang, preferred: readonly string[] = browserLanguages()): string {
  return preferred.find((tag) => tag.toLowerCase().split('-')[0] === lang) ?? lang;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

export interface Calendar {
  locale: string;
  firstDay: Weekday;
  /** "Mon" */
  weekdayShort: (key: DateKey) => string;
  /** "23" */
  dayNumber: (key: DateKey) => string;
  /** "Mon, Nov 23" */
  dayShort: (key: DateKey) => string;
  /** "Monday, November 23, 2026" */
  dayLong: (key: DateKey) => string;
  /** "November 2026" */
  monthLabel: (month: MonthKey) => string;
  /** "Nov 23 – 29, 2026" */
  rangeLabel: (from: DateKey, to: DateKey) => string;
}

export function useCalendar(): Calendar {
  const [lang] = useLang();
  return useMemo(() => {
    const locale = calendarLocale(lang);
    const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options);
    const weekdayShort = fmt({ weekday: 'short' });
    const dayNumber = fmt({ day: 'numeric' });
    const dayShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
    const dayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const month = fmt({ month: 'long', year: 'numeric' });
    const range = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
    return {
      locale,
      firstDay: firstDayOfWeek(locale),
      weekdayShort: (key) => weekdayShort.format(dateForFormat(key)),
      dayNumber: (key) => dayNumber.format(dateForFormat(key)),
      dayShort: (key) => dayShort.format(dateForFormat(key)),
      dayLong: (key) => dayLong.format(dateForFormat(key)),
      monthLabel: (m) => month.format(dateForFormat(firstOfMonth(m))),
      rangeLabel: (from, to) =>
        typeof range.formatRange === 'function'
          ? range.formatRange(dateForFormat(from), dateForFormat(to))
          : `${range.format(dateForFormat(from))} – ${range.format(dateForFormat(to))}`,
    } satisfies Calendar;
  }, [lang]);
}

/** Today's local date; re-checked every minute so the view moves on after midnight. */
export function useToday(): DateKey {
  const [today, setToday] = useState(() => todayKey());
  useEffect(() => {
    const timer = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
