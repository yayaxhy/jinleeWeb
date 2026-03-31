import { formatDateTimeInputUtc } from '@/lib/utcDateRange';

const TIME_ZONE = 'Europe/Rome';

type CentralEuropeanDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZoneName?: string;
};

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const formatterWithZone = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
  hourCycle: 'h23',
});

const pad2 = (value: number) => String(value).padStart(2, '0');

const getNumericPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) => {
  const value = parts.find((part) => part.type === type)?.value;
  return value ? Number(value) : 0;
};

const getTextPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((part) => part.type === type)?.value;

const getCentralEuropeanDateTimeParts = (date: Date): CentralEuropeanDateTimeParts => {
  const parts = formatterWithZone.formatToParts(date);
  return {
    year: getNumericPart(parts, 'year'),
    month: getNumericPart(parts, 'month'),
    day: getNumericPart(parts, 'day'),
    hour: getNumericPart(parts, 'hour'),
    minute: getNumericPart(parts, 'minute'),
    second: getNumericPart(parts, 'second'),
    timeZoneName: getTextPart(parts, 'timeZoneName'),
  };
};

const buildDateTimeInput = (
  parts: Pick<CentralEuropeanDateTimeParts, 'year' | 'month' | 'day' | 'hour' | 'minute'>
) => `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;

const getTimeZoneOffsetMs = (date: Date) => {
  const parts = formatter.formatToParts(date);
  const asUtc = Date.UTC(
    getNumericPart(parts, 'year'),
    getNumericPart(parts, 'month') - 1,
    getNumericPart(parts, 'day'),
    getNumericPart(parts, 'hour'),
    getNumericPart(parts, 'minute'),
    getNumericPart(parts, 'second'),
    0
  );
  const actualUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    0
  );
  return asUtc - actualUtc;
};

const centralEuropeanLocalToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
) => {
  const localMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let resolvedMs = localMs;

  for (let index = 0; index < 3; index += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(resolvedMs));
    const nextMs = localMs - offsetMs;
    if (nextMs === resolvedMs) break;
    resolvedMs = nextMs;
  }

  return new Date(resolvedMs);
};

export const formatDateTimeInputCentralEuropean = (date: Date) =>
  buildDateTimeInput(getCentralEuropeanDateTimeParts(date));

export const formatDateTimeTextCentralEuropean = (date: Date) => {
  const parts = getCentralEuropeanDateTimeParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(
    parts.minute
  )}:${pad2(parts.second)} ${parts.timeZoneName ?? TIME_ZONE}`;
};

export const parseDateTimeLocalAsCentralEuropean = (raw?: string) => {
  const value = raw?.trim();
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );
  if (!match) return null;

  const [, y, m, d, hh, mm, ss = '0', msRaw = '0'] = match;
  const ms = msRaw.padEnd(3, '0');
  const date = centralEuropeanLocalToUtc(
    Number(y),
    Number(m),
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    Number(ms)
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

export const convertCentralEuropeanInputToUtcInput = (raw?: string) => {
  const parsed = parseDateTimeLocalAsCentralEuropean(raw);
  return parsed ? formatDateTimeInputUtc(parsed) : null;
};

export function parseCentralEuropeanDateRange(startRaw?: string, endRaw?: string) {
  const now = new Date();
  const nowParts = getCentralEuropeanDateTimeParts(now);
  const nextMonthYear = nowParts.month === 12 ? nowParts.year + 1 : nowParts.year;
  const nextMonth = nowParts.month === 12 ? 1 : nowParts.month + 1;

  const defaultStart = centralEuropeanLocalToUtc(nowParts.year, nowParts.month, 1, 0, 0, 0, 0);
  const defaultEnd = centralEuropeanLocalToUtc(nextMonthYear, nextMonth, 1, 0, 0, 0, 0);

  const parsedStart = parseDateTimeLocalAsCentralEuropean(startRaw);
  const parsedEnd = parseDateTimeLocalAsCentralEuropean(endRaw);

  const start = parsedStart ?? defaultStart;
  const end = parsedEnd ?? defaultEnd;

  if (start.getTime() >= end.getTime()) {
    return {
      start: defaultStart,
      end: defaultEnd,
      startValue: formatDateTimeInputCentralEuropean(defaultStart),
      endValue: formatDateTimeInputCentralEuropean(defaultEnd),
    };
  }

  return {
    start,
    end,
    startValue: formatDateTimeInputCentralEuropean(start),
    endValue: formatDateTimeInputCentralEuropean(end),
  };
}
