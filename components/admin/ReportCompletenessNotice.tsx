import React from 'react';

type Completeness = { complete: boolean; issues: Array<{ source: string; ids: string[]; orderIds: string[]; reason: string }> };
export function ReportCompletenessNotice({ completeness, historical = false }: { completeness?: Completeness; historical?: boolean }) {
  if (!completeness) return historical ? <p className="rounded-xl border border-white/15 p-4 text-sm text-white/60">此已确认历史报表未保存完整度检查结果；原有数字和文件保持不变。</p> : null;
  if (completeness.complete) return null;
  return <section role="alert" className="space-y-3 rounded-xl border border-amber-300/50 bg-amber-300/10 p-5 text-amber-100">
    <h3 className="text-lg font-semibold">报表不完整：下方金额仅为已核实部分</h3>
    <p className="text-sm">{completeness.issues.length} 项凭据待核实。</p>
    <ul className="space-y-3 text-sm">{completeness.issues.map((issue, index) => <li key={`${issue.source}-${index}`} className="break-words">
      <p>{issue.reason}</p>
      {issue.ids.length > 0 && <p className="break-all text-xs">记录编号：{issue.ids.join('、')}</p>}
      {issue.orderIds.length > 0 && <p className="break-all text-xs">订单编号：{issue.orderIds.join('、')}</p>}
    </li>)}</ul>
  </section>;
}
