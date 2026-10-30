import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  buildMonthlyBalanceSheetModel,
  calculateRecordedBankCash,
  rewindWalletTransactionChain,
  summarizeManualCashExpenses,
  summarizeRechargeCashFlow,
} from './admin/monthly-financial-reports';

const amount = (value: string) => new Prisma.Decimal(value);

test('month-end wallet rewind follows balances when concurrent ledger timestamps are inverted', () => {
  const opening = rewindWalletTransactionChain(amount('2824.51'), [
    { balanceBefore: amount('2381.81'), balanceAfter: amount('2820.13') },
    { balanceBefore: amount('2820.13'), balanceAfter: amount('2824.51') },
  ]);
  assert.equal(opening.toString(), '2381.81');
});

test('month-end wallet rewind refuses a missing or disconnected transaction', () => {
  assert.throws(() => rewindWalletTransactionChain(amount('100'), [
    { balanceBefore: amount('50'), balanceAfter: amount('90') },
  ]), /无法接续/);
});

test('negative Recharge offsets positive Recharge in bank cash and later month opening', () => {
  const recharge = summarizeRechargeCashFlow([
    { amount: amount('14636') },
    { amount: amount('-500') },
    { amount: amount('-250') },
  ]);
  assert.equal(recharge.positive.toString(), '14636');
  assert.equal(recharge.negative.toString(), '750');
  assert.equal(recharge.net.toString(), '13886');

  const september = calculateRecordedBankCash(amount('0'), recharge.net, amount('1815.92'), amount('2266'));
  assert.equal(september.movement.toString(), '9804.08');
  assert.equal(september.closing.toString(), '9804.08');

  const october = calculateRecordedBankCash(september.closing, amount('120'), amount('1064'), amount('0'), amount('8000'));
  assert.equal(october.closing.toString(), '860.08');
});

test('late-paid expense correction changes current book cash without inventing a new payment date', () => {
  const summary = summarizeManualCashExpenses([
    { amount: amount('50'), note: '本月采购', cashFlowCorrection: false },
    { amount: amount('100'), note: '前期调整（2026-10）：补记', cashFlowCorrection: true },
    { amount: amount('25'), note: '前期调整（2026-10）：非现金改动', cashFlowCorrection: false },
  ]);
  assert.equal(summary.currentCashOutflow.toString(), '50');
  assert.equal(summary.priorPeriodCashCorrection.toString(), '100');
  assert.equal(summary.priorPeriodAdjustment.toString(), '125');
  const cash = calculateRecordedBankCash(amount('1000'), amount('0'), amount('0'),
    summary.currentCashOutflow, amount('0'), summary.priorPeriodCashCorrection);
  assert.equal(cash.closing.toString(), '850');
});

test('voiding a linked prior-period payment reverses its cash correction', () => {
  const summary = summarizeManualCashExpenses([
    { amount: amount('100'), note: '前期调整（2026-10）：补记', cashFlowCorrection: true },
    { amount: amount('-100'), note: '前期调整（2026-10）：撤销', cashFlowCorrection: true },
  ]);
  assert.equal(summary.priorPeriodCashCorrection.toString(), '0');
  assert.equal(summary.priorPeriodAdjustment.toString(), '0');
});

test('a monthly loss reduces equity without becoming a negative dividend or asset', () => {
  const balanceSheet = buildMonthlyBalanceSheetModel({
    estimatedBankCash: amount('9804.08'),
    userBalance: amount('12735.71'),
    netProfit: amount('-2931.63'),
    openingCapital: amount('0'),
    dividendDeclared: amount('0'),
    dividendPayable: amount('0'),
    adjustments: { priorProfitRows: [], assetRows: [], liabilityRows: [], equityRows: [] },
  });

  assert.deepEqual(balanceSheet.assetRows.map((row) => row.item), ['月末银行余额（账面推算）']);
  assert.deepEqual(balanceSheet.liabilityRows.map((row) => row.item), ['用户余额', '待发提现', '应付分红']);
  assert.equal(balanceSheet.equityRows.find((row) => row.item === '当月盈亏')?.category, '本期亏损');
  assert.equal(balanceSheet.equityTotal.toString(), '-2931.63');
  assert.equal(balanceSheet.reconciliationDifference.toString(), '0');
});

test('pending withdrawal transfers wallet liability to payable without deducting wallet or cash twice', () => {
  for (const state of [
    { cash: '1000', pending: '200' }, // Requested: wallet already reduced from 1000 to 800.
    { cash: '800', pending: '0' }, // Paid: cash and payable fall, wallet stays at 800.
    { cash: '1000', pending: '200' }, // Payment revoked: restore cash and payable only.
  ]) {
    const model = buildMonthlyBalanceSheetModel({
      estimatedBankCash: amount(state.cash), userBalance: amount('800'),
      withdrawalPayable: amount(state.pending),
      netProfit: amount('0'), openingCapital: amount('0'),
      dividendDeclared: amount('0'), dividendPayable: amount('0'),
      adjustments: { priorProfitRows: [], assetRows: [], liabilityRows: [], equityRows: [] },
    });
    assert.equal(model.liabilityRows.find(row => row.item === '用户余额')?.amount.toString(), '800');
    assert.equal(model.liabilityRows.find(row => row.item === '待发提现')?.amount.toString(), state.pending);
    assert.equal(model.reconciliationDifference.toString(), '0');
  }
});

test('a monthly profit increases equity and prior profit stays separately identified', () => {
  const balanceSheet = buildMonthlyBalanceSheetModel({
    estimatedBankCash: amount('300'),
    userBalance: amount('100'),
    netProfit: amount('50'),
    openingCapital: amount('0'),
    dividendDeclared: amount('0'),
    dividendPayable: amount('0'),
    adjustments: {
      priorProfitRows: [{ label: '往期盈亏', amount: 25, note: '历史结转' }],
      assetRows: [], liabilityRows: [], equityRows: [],
    },
  });

  assert.equal(balanceSheet.equityRows.find((row) => row.item === '当月盈亏')?.category, '本期盈利');
  assert.equal(balanceSheet.equityRows.find((row) => row.item === '当月盈亏')?.amount.toString(), '50');
  assert.equal(balanceSheet.equityTotal.toString(), '75');
  assert.equal(balanceSheet.liabilityTotal.toString(), '100');
});

test('declared dividends transfer profit from capital to payable; payment is cash only', () => {
  const september = buildMonthlyBalanceSheetModel({
    estimatedBankCash: amount('10000'), userBalance: amount('0'), netProfit: amount('10000'),
    openingCapital: amount('0'), dividendDeclared: amount('8000'), dividendPayable: amount('8000'),
    adjustments: { priorProfitRows: [], assetRows: [], liabilityRows: [], equityRows: [] },
  });
  assert.equal(september.equityTotal.toString(), '2000');
  assert.equal(september.liabilityTotal.toString(), '8000');
  const october = buildMonthlyBalanceSheetModel({
    estimatedBankCash: amount('-1000'), userBalance: amount('0'), netProfit: amount('-3000'),
    openingCapital: september.equityTotal, dividendDeclared: amount('0'), dividendPayable: amount('0'),
    adjustments: { priorProfitRows: [], assetRows: [], liabilityRows: [], equityRows: [] },
  });
  assert.equal(october.equityTotal.toString(), '-1000');
});
