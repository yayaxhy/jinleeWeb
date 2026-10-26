export type ReportFactIssue = {
  source: 'order' | 'discount' | 'voucher' | 'manual-adjustment';
  ids: string[];
  orderIds: string[];
  reason: string;
};
export const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const stringId = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
export const orderFromKey = (value: unknown) => typeof value === 'string' && value.startsWith('ORDER:') && value.length > 6 ? value.slice(6) : null;

/** Connected facts are one validation unit. A duplicate identifier connects
 * both candidates before either can be accepted; no first-row-wins fallback. */
export function groupReportFacts<T>(rows: T[], keys: (row: T) => string[]): T[][] {
  const parent = rows.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const first = new Map<string, number>();
  rows.forEach((row, index) => {
    for (const key of keys(row)) {
      const previous = first.get(key);
      if (previous === undefined) first.set(key, index);
      else parent[find(index)] = find(previous);
    }
  });
  const groups = new Map<number, T[]>();
  rows.forEach((row, index) => { const root = find(index); const group = groups.get(root) ?? []; group.push(row); groups.set(root, group); });
  return [...groups.values()];
}
export const uniqueIds = (values: Array<string | null | undefined>) => [...new Set(values.filter((v): v is string => Boolean(v)))];
