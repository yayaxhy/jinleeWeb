import React from 'react';
import { formatAmountDown2 } from '@/lib/numberFormat';

type Completeness = { complete: boolean; issues: Array<{ source: string; ids: string[]; orderIds: string[]; reason: string }> };
export function ReportCompletenessNotice({ completeness, historical = false }: { completeness?: Completeness; historical?: boolean }) {
  if (!completeness) return historical ? <p className="rounded-xl border border-white/15 p-4 text-sm text-white/60">此已确认历史报表未保存完整度检查结果；原有数字和文件保持不变。</p> : null;
  if (completeness.complete) return <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-300/5 p-4 text-sm text-emerald-100">本次统计的订单、优惠和调整凭据检查完整。此状态不代表已完成银行对账。</p>;
  return <section role="alert" className="space-y-3 rounded-xl border border-amber-300/50 bg-amber-300/10 p-5 text-amber-100">
    <h3 className="text-lg font-semibold">报表不完整：下方金额仅为已核实部分</h3>
    <p className="text-sm">{completeness.issues.length} 项凭据待核实，相关部分暂未计入；当前报表不能确认月结。导出文件会同时列出缺失项目。</p>
    <ul className="space-y-3 text-sm">{completeness.issues.map((issue, index) => <li key={`${issue.source}-${index}`} className="break-words">
      <p>{issue.reason}</p>
      {issue.ids.length > 0 && <p className="break-all text-xs">记录编号：{issue.ids.join('、')}</p>}
      {issue.orderIds.length > 0 && <p className="break-all text-xs">订单编号：{issue.orderIds.join('、')}</p>}
    </li>)}</ul>
  </section>;
}
export function ManualRevenueAdjustmentSummary({ adjustments }: { adjustments?: { walletNetDelta: string | { toString(): string }; profitDelta: string | { toString(): string }; rows: Array<unknown> } }) {
  if (!adjustments) return null;
  return <section className="space-y-2 rounded-xl border border-sky-200/30 bg-sky-100/5 p-5 text-white">
    <h3 className="text-lg font-semibold">人工退款与调整</h3>
    <p className="text-sm">本期已完成 {adjustments.rows.length} 笔；用户钱包净变动 ¥{formatAmountDown2(adjustments.walletNetDelta)}，对净收益的影响 ¥{formatAmountDown2(adjustments.profitDelta)}。</p>
    <p className="text-xs text-white/60">净收益影响单独列示一次；不计作充值、抽成或银行现金收支。逐笔凭据见导出文件的人工调整明细页。</p>
  </section>;
}
