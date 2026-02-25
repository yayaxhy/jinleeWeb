const pad2 = (value: number) => String(value).padStart(2, '0');

export const formatDateTimeInputUtc = (date: Date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(
    date.getUTCHours()
  )}:${pad2(date.getUTCMinutes())}`;

export const formatDateTimeTextUtc = (date: Date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(
    date.getUTCHours()
  )}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())} UTC+0`;

export const formatFileTimestampUtc = (date = new Date()) => {
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
};

export const parseDateTimeLocalAsUtc = (raw?: string) => {
  const value = raw?.trim();
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );
  if (!match) return null;

  const [, y, m, d, hh, mm, ss = '0', msRaw = '0'] = match;
  const ms = msRaw.padEnd(3, '0');
  const date = new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss), Number(ms))
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

export function parseUtcDateRange(startRaw?: string, endRaw?: string) {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  const parsedStart = parseDateTimeLocalAsUtc(startRaw);
  const parsedEnd = parseDateTimeLocalAsUtc(endRaw);

  const start = parsedStart ?? defaultStart;
  const end = parsedEnd ?? defaultEnd;

  if (start.getTime() >= end.getTime()) {
    return {
      start: defaultStart,
      end: defaultEnd,
      startValue: formatDateTimeInputUtc(defaultStart),
      endValue: formatDateTimeInputUtc(defaultEnd),
    };
  }

  return {
    start,
    end,
    startValue: formatDateTimeInputUtc(start),
    endValue: formatDateTimeInputUtc(end),
  };
}

