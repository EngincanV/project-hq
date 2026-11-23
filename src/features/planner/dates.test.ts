import {
  addDays,
  addMonths,
  addMonthsToDate,
  dateForFormat,
  daysInMonth,
  diffDays,
  firstDayOfWeek,
  isDateKey,
  monthGrid,
  monthOf,
  monthsBetween,
  parseDate,
  startOfWeek,
  todayKey,
  weekday,
  weekOf,
} from './dates';

describe('parseDate / isDateKey', () => {
  it('accepts real calendar days only', () => {
    expect(parseDate('2026-11-23')).toEqual({ year: 2026, month: 11, day: 23 });
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2100-02-29')).toBe(false);
    expect(isDateKey('2000-02-29')).toBe(true);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-11-31')).toBe(false);
    expect(isDateKey('2026-1-05')).toBe(false);
    expect(isDateKey(' 2026-11-23')).toBe(false);
  });

  it('knows month lengths', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => daysInMonth(2026, m))).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe('addDays / diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-11-23', 0)).toBe('2026-11-23');
    expect(addDays('2026-01-15', 365)).toBe('2027-01-15');
  });

  it('is not affected by DST changes (pure day counts)', () => {
    // Europe/US DST switches happen around these dates; whole days are still whole days.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('measures distances', () => {
    expect(diffDays('2026-11-23', '2026-12-01')).toBe(8);
    expect(diffDays('2026-12-01', '2026-11-23')).toBe(-8);
    expect(diffDays('1970-01-01', '2000-01-01')).toBe(10957);
  });
});

describe('weekday / weeks', () => {
  it('computes the day of the week', () => {
    expect(weekday('1970-01-01')).toBe(4);
    expect(weekday('2026-11-23')).toBe(1); // Monday
    expect(weekday('2026-11-29')).toBe(0); // Sunday
    expect(weekday('1969-12-31')).toBe(3);
  });

  it('starts weeks on the given day', () => {
    expect(startOfWeek('2026-11-23', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-29', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-29', 0)).toBe('2026-11-29');
    expect(startOfWeek('2026-11-28', 0)).toBe('2026-11-22');
    expect(startOfWeek('2026-11-27', 6)).toBe('2026-11-21');
    expect(startOfWeek('2027-01-01', 1)).toBe('2026-12-28');
  });

  it('lists the seven days of a week across a year boundary', () => {
    expect(weekOf('2026-12-31', 1)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });
});

describe('months', () => {
  it('adds months across years', () => {
    expect(monthOf('2026-11-23')).toBe('2026-11');
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', -23)).toBe('2024-12');
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDate('2028-03-31', -1)).toBe('2028-02-29');
  });

  it('lists the months of a range', () => {
    expect(monthsBetween('2026-11-30', '2026-12-06')).toEqual(['2026-11', '2026-12']);
    expect(monthsBetween('2026-12-28', '2027-01-03')).toEqual(['2026-12', '2027-01']);
    expect(monthsBetween('2026-11-02', '2026-11-08')).toEqual(['2026-11']);
  });

  it('builds a month grid of full weeks', () => {
    const grid = monthGrid('2026-11', 1);
    expect(grid[0][0]).toBe('2026-10-26');
    expect(grid[grid.length - 1][6]).toBe('2026-12-06');
    expect(grid).toHaveLength(6);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    const sunday = monthGrid('2026-02', 0);
    expect(sunday[0][0]).toBe('2026-02-01');
    expect(sunday).toHaveLength(4);
  });
});

describe('todayKey', () => {
  it('uses the local calendar date, also just before midnight', () => {
    expect(todayKey(new Date(2026, 10, 23, 23, 59, 59))).toBe('2026-11-23');
    expect(todayKey(new Date(2026, 11, 31, 0, 0, 1))).toBe('2026-12-31');
  });

  it('formats with a local date that keeps the day', () => {
    const date = dateForFormat('2026-03-29');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 29]);
  });
});

describe('firstDayOfWeek', () => {
  const proto = Intl.Locale.prototype as unknown as { getWeekInfo?: () => unknown };
  const original = proto.getWeekInfo;
  afterEach(() => {
    proto.getWeekInfo = original;
  });

  function fakeWeekInfo(info: unknown) {
    proto.getWeekInfo = () => info;
  }

  it('reads Intl week info (1 = Monday … 7 = Sunday)', () => {
    fakeWeekInfo({ firstDay: 7 });
    expect(firstDayOfWeek('en-US')).toBe(0);
    fakeWeekInfo({ firstDay: 1 });
    expect(firstDayOfWeek('tr-TR')).toBe(1);
    fakeWeekInfo({ firstDay: 6 });
    expect(firstDayOfWeek('ar-EG')).toBe(6);
  });

  it('falls back to Monday without week info or for bad tags', () => {
    fakeWeekInfo(undefined);
    expect(firstDayOfWeek('en-US')).toBe(1);
    proto.getWeekInfo = undefined;
    expect(firstDayOfWeek('en-US')).toBe(1);
    proto.getWeekInfo = original;
    expect(firstDayOfWeek('not a locale!')).toBe(1);
  });
});
