/**
 * The point at which DLMClub started operating independently. Legacy rows,
 * including the legacy balance-settlement rows written exactly at this time,
 * remain archived but are not shown in new-entity operational screens.
 */
export const NEW_ENTITY_OPERATIONS_STARTED_AT = new Date('2026-09-25T19:26:50.956Z');
export const NEW_ENTITY_OPERATIONS_STARTED_MONTH_KEY = '2026-09';

export const isNewEntityReportMonth = (monthKey: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) && monthKey >= NEW_ENTITY_OPERATIONS_STARTED_MONTH_KEY;

export const newEntityOnlyTime = (requestedStart?: Date | null) => {
  if (requestedStart && requestedStart.getTime() > NEW_ENTITY_OPERATIONS_STARTED_AT.getTime()) {
    return { gte: requestedStart };
  }

  return { gt: NEW_ENTITY_OPERATIONS_STARTED_AT };
};

/**
 * For report queries that require one inclusive range start, advance one
 * millisecond past the cutover so settlement rows at the exact cutover are
 * excluded.
 */
export const newEntityReportStart = (requestedStart: Date) => {
  if (requestedStart.getTime() > NEW_ENTITY_OPERATIONS_STARTED_AT.getTime()) return requestedStart;
  return new Date(NEW_ENTITY_OPERATIONS_STARTED_AT.getTime() + 1);
};
