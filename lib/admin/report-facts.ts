export type ReportFactIssue = {
  source: 'order' | 'discount' | 'voucher' | 'manual-adjustment';
  ids: string[];
  orderIds: string[];
  reason: string;
};
export type ReportCompleteness = { complete: boolean; issues: ReportFactIssue[] };
export const reportCompleteness = (issues: ReportFactIssue[]): ReportCompleteness => ({ complete: issues.length === 0, issues });
export const assertReportComplete = (facts: ReportCompleteness) => {
  if (!facts.complete || facts.issues.length) throw new Error(`报表仍有 ${facts.issues.length} 组待核实事实，只能查看已核实部分，不能确认正式月报。`);
};
export const assertReportBalanced = (difference: string) => {
  if (!/^[-+]?0(?:\.0+)?$/.test(difference)) throw new Error('资产负债表仍有核对差额，不能确认正式月报。');
};
export const reportStatusRows = (facts: ReportCompleteness) => [
  { section: '完整度', key: '状态', value: facts.complete ? '完整' : '不完整：仅已核实部分，不是完整总账' },
  { section: '完整度', key: '待核实组数', value: facts.issues.length },
  { section: '完整度', key: '说明', value: '未核实金额未计入，不代表金额为零；同原单关联或重复冲突整组排除，正式月报须核实全部差异。' },
];
export const reportIssueRows = (facts: ReportCompleteness) => facts.issues.map(issue => ({
  source: issue.source, recordIds: issue.ids.join(' / '), orderIds: issue.orderIds.join(' / '), reason: issue.reason,
}));
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
