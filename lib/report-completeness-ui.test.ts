import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportCompletenessNotice, ManualRevenueAdjustmentSummary } from '../components/admin/ReportCompletenessNotice';

test('partial report visibly identifies missing facts and disallows complete-total interpretation', () => {
  const html = renderToStaticMarkup(React.createElement(ReportCompletenessNotice, { completeness: { complete: false, issues: [
    { source: 'order', ids: ['audit-1'], orderIds: ['order-1'], reason: '原订单付款快照缺失' },
  ] } }));
  for (const text of ['role="alert"', '报表不完整', '金额仅为已核实部分', '不能确认月结', 'audit-1', 'order-1', '原订单付款快照缺失']) assert.ok(html.includes(text), text);
});
test('complete fact checks do not claim bank reconciliation has been completed', () => {
  const html = renderToStaticMarkup(React.createElement(ReportCompletenessNotice, { completeness: { complete: true, issues: [] } }));
  assert.ok(html.includes('凭据检查完整')); assert.ok(html.includes('不代表已完成银行对账')); assert.ok(!html.includes('role="alert"'));
});
test('old confirmed snapshots without completeness retain historical meaning', () => {
  const html = renderToStaticMarkup(React.createElement(ReportCompletenessNotice, { historical: true }));
  assert.ok(html.includes('未保存完整度检查结果')); assert.ok(html.includes('原有数字和文件保持不变')); assert.ok(!html.includes('凭据检查完整'));
});
test('manual adjustments keep wallet and profit signs distinct without treating either as cash flow', () => {
  const html = renderToStaticMarkup(React.createElement(ManualRevenueAdjustmentSummary, { adjustments: { walletNetDelta: '25', profitDelta: '-25', rows: [{}] } }));
  assert.ok(html.includes('钱包净变动 ¥25.00')); assert.ok(html.includes('净收益的影响 ¥-25.00'));
  assert.ok(html.includes('不计作充值、抽成或银行现金收支'));
  assert.equal((html.match(/净收益的影响/g) || []).length, 1);
});
