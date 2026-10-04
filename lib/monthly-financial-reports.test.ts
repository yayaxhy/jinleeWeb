import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  buildMonthlyBalanceSheetModel,
  calculateRecordedBankCash,
  rewindWalletTransactionChain,
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

test('bank cash starts at zero and rolls forward using only recorded cash movements', () => {
  const september = calculateRecordedBankCash(amount('0'), amount('14636'), amount('1815.92'), amount('0'));
  assert.equal(september.movement.toString(), '12820.08');
  assert.equal(september.closing.toString(), '12820.08');

  const october = calculateRecordedBankCash(september.closing, amount('120'), amount('1064'), amount('0'), amount('8000'));
  assert.equal(october.closing.toString(), '3876.08');
});

test('a monthly loss reduces equity without becoming a negative dividend or asset', () => {
  const balanceSheet = buildMonthlyBalanceSheetModel({
    estimatedBankCash: amount('12820.08'),
    userBalance: amount('12735.71'),
    netProfit: amount('-2931.63'),
    openingCapital: amount('0'),
    dividendDeclared: amount('0'),
    dividendPayable: amount('0'),
    adjustments: { priorProfitRows: [], assetRows: [], liabilityRows: [], equityRows: [] },
  });

  assert.deepEqual(balanceSheet.assetRows.map((row) => row.item), ['期末银行余额（账面推算）']);
  assert.deepEqual(balanceSheet.liabilityRows.map((row) => row.item), ['用户余额', '应付分红']);
  assert.equal(balanceSheet.equityRows.find((row) => row.item === '当月盈亏')?.category, '本期亏损');
  assert.equal(balanceSheet.equityTotal.toString(), '-2931.63');
  assert.equal(balanceSheet.reconciliationDifference.toString(), '3016');
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
