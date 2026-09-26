export const BERLIN_TIME_ZONE = 'Europe/Berlin';
export const OPENING_BENEFITS_START = new Date('2026-09-26T00:00:00.000+02:00');
export const OPENING_BENEFITS_END = new Date('2026-12-01T23:59:59.999+01:00');
export const OPENING_DAILY_COUPON_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;
export const OPENING_WEEKLY_SPEND_TARGET = 1000;
export const OPENING_NEW_USER_ORDER_TARGET = 2;
export const OPENING_NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const berlinDateFormatter = new Intl.DateTimeFormat('en-GB', {
  calendar: 'gregory',
  timeZone: BERLIN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const localDateParts = (date: Date): DateParts => {
  const values = berlinDateFormatter.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

const dateKey = (year: number, month: number, day: number) =>
  `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

const offsetAt = (date: Date) => {
  const parts = localDateParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
};

/** Converts a real Berlin wall-clock time to UTC, including CET/CEST transitions. */
const berlinLocalTime = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let value = new Date(utcGuess - offsetAt(new Date(utcGuess)));
  const corrected = new Date(utcGuess - offsetAt(value));
  if (corrected.getTime() !== value.getTime()) value = corrected;
  return value;
};

export const getBerlinDateKey = (now = new Date()) => {
  const parts = localDateParts(now);
  return dateKey(parts.year, parts.month, parts.day);
};

export const getBerlinMidnight = (now = new Date()) => {
  const parts = localDateParts(now);
  return berlinLocalTime(parts.year, parts.month, parts.day);
};

export const getNextBerlinMidnight = (now = new Date()) => {
  const parts = localDateParts(now);
  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return berlinLocalTime(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate());
};

export const getBerlinWeekStart = (now = new Date()) => {
  const parts = localDateParts(now);
  const localCalendarDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const daysSinceMonday = (localCalendarDate.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysSinceMonday));
  return berlinLocalTime(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
};

export const getBerlinWeekKey = (now = new Date()) => getBerlinDateKey(getBerlinWeekStart(now));

export const getBerlinWeekEnd = (now = new Date()) => {
  const parts = localDateParts(getBerlinWeekStart(now));
  const nextMonday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 7));
  return berlinLocalTime(nextMonday.getUTCFullYear(), nextMonday.getUTCMonth() + 1, nextMonday.getUTCDate());
};

export const isOpeningBenefitsActive = (now = new Date()) =>
  now >= OPENING_BENEFITS_START && now < OPENING_BENEFITS_END;

export const getOpeningCouponExpiresAt = (now = new Date()) =>
  new Date(now.getTime() + OPENING_DAILY_COUPON_VALIDITY_MS);

export const getNewUserTaskDeadline = (accountCreatedAt: Date) =>
  new Date(accountCreatedAt.getTime() + OPENING_NEW_USER_WINDOW_MS);
