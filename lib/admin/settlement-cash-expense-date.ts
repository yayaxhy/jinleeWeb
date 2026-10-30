import { formatDateTimeInputCentralEuropean } from '@/lib/centralEuropeanDateRange';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '@/lib/operating-entity-cutover';

export const parseActualPaidOn = (raw: string, now = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  const today = formatDateTimeInputCentralEuropean(now).slice(0, 10);
  const firstDay = formatDateTimeInputCentralEuropean(NEW_ENTITY_OPERATIONS_STARTED_AT).slice(0, 10);
  if (raw < firstDay || raw > today) return null;
  return { date, monthKey: raw.slice(0, 7) };
};
