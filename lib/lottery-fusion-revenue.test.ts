import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLotteryFusionActivityBreakdown } from './admin/lottery-fusion-revenue';

test('buildLotteryFusionActivityBreakdown summarizes rule, source, and reroll-chain usage', () => {
  const summary = buildLotteryFusionActivityBreakdown({
    createdOutputs: [
      { id: 'out-1', requestId: 'req-1', pool: 'MEDIUM' },
      { id: 'out-2', requestId: 'req-2', pool: 'ADVANCED' },
      { id: 'out-3', requestId: 'req-3', pool: 'SPECIAL' },
      { id: 'out-4', requestId: null, pool: 'NORMAL' },
    ],
    outstandingOutputs: [
      { pool: 'SPECIAL' },
      { pool: 'SPECIAL' },
      { pool: 'MEDIUM' },
    ],
    sourceItems: [
      { requestId: 'req-1', sourceKind: 'coupon', pool: 'NORMAL' },
      {
        requestId: 'req-1',
        sourceKind: 'lottery',
        pool: 'ADVANCED',
        sourceNonce: 'fusion:older-output',
      },
      { requestId: 'req-1', sourceKind: 'pointshop', pool: 'MEDIUM' },
      { requestId: 'req-2', sourceKind: 'coupon', pool: 'NORMAL' },
      { requestId: 'req-2', sourceKind: 'coupon', pool: 'MEDIUM' },
      { requestId: 'req-2', sourceKind: 'lottery', pool: 'SPECIAL', sourceNonce: 'draw:plain' },
      { requestId: 'req-2', sourceKind: 'pointshop', pool: 'ADVANCED' },
      { requestId: 'req-3', sourceKind: 'lottery', pool: 'SPECIAL', sourceNonce: 'fusion:second-chain' },
      { requestId: 'req-3', sourceKind: 'lottery', pool: 'SPECIAL', sourceNonce: 'fusion:third-chain' },
      { requestId: 'req-3', sourceKind: 'pointshop', pool: 'ADVANCED' },
      { requestId: 'req-3', sourceKind: 'coupon', pool: 'MEDIUM' },
      { requestId: 'req-3', sourceKind: 'coupon', pool: 'NORMAL' },
      { requestId: 'req-3', sourceKind: 'coupon', pool: 'NORMAL' },
    ],
  });

  assert.deepEqual(summary.createdPoolBreakdown, {
    MEDIUM: 1,
    ADVANCED: 1,
    SPECIAL: 1,
    NORMAL: 1,
  });
  assert.deepEqual(summary.activeOutstandingPoolBreakdown, {
    SPECIAL: 2,
    MEDIUM: 1,
  });
  assert.deepEqual(summary.fusionCountBreakdown, {
    '3': 1,
    '4': 1,
    '6': 1,
    other: 1,
  });
  assert.deepEqual(summary.sourceKindBreakdown, {
    lottery: 4,
    coupon: 6,
    pointshop: 3,
  });
  assert.deepEqual(summary.sourcePoolBreakdown, {
    NORMAL: 4,
    ADVANCED: 3,
    MEDIUM: 3,
    SPECIAL: 3,
  });
  assert.equal(summary.rerolledLotteryInputCount, 3);
  assert.equal(summary.rerolledRequestCount, 2);
  assert.deepEqual(summary.resultPoolByFusionCount['3'], { MEDIUM: 1 });
  assert.deepEqual(summary.resultPoolByFusionCount['4'], { ADVANCED: 1 });
  assert.deepEqual(summary.resultPoolByFusionCount['6'], { SPECIAL: 1 });
  assert.deepEqual(summary.resultPoolByFusionCount.other, { NORMAL: 1 });
});
