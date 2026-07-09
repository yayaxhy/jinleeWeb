import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLotteryFusionSourceRef,
  LOTTERY_FUSION_RULES,
  buildLotteryFusionApiError,
  buildLotteryFusionHistoryEntries,
  isLotteryFusionNonce,
  parseLotteryFusionSourceRef,
  resolveLotteryFusionDisplayStatus,
} from './lottery-fusion';

test('6 fusion rule excludes normal pool in UI copy', () => {
  assert.equal(LOTTERY_FUSION_RULES[6].eligibleRangeLabel, '金色 / 高级 / 特殊（不会出银色奖品）');
  assert.match(LOTTERY_FUSION_RULES[6].detail, /不会出银色/);
});

test('known fusion business errors map to actionable status codes', () => {
  const error = buildLotteryFusionApiError({ code: 'SOURCE_ITEM_UNAVAILABLE' });
  assert.equal(error.status, 409);
  assert.equal(error.message, '所选奖品已使用、已过期或已被融合，请刷新后重试');
});

test('unknown upstream 5xx errors stay as service failures', () => {
  const error = buildLotteryFusionApiError({
    code: 'SOMETHING_ELSE',
    fallbackStatus: 502,
    fallbackMessage: '重铸服务暂不可用，请稍后重试',
  });
  assert.equal(error.status, 502);
  assert.equal(error.message, '重铸服务暂不可用，请稍后重试');
});

test('expired unused fusion outputs display as expired', () => {
  const status = resolveLotteryFusionDisplayStatus('UNUSED', '2026-01-01T00:00:00.000Z', new Date('2026-07-01T00:00:00.000Z'));
  assert.equal(status, 'EXPIRED');
});

test('history builder groups source items by requestId and sorts newest output first', () => {
  const entries = buildLotteryFusionHistoryEntries(
    [
      {
        id: 'out-older',
        requestId: 'req-older',
        nonce: 'fusion:older',
        createdAt: '2026-07-06T00:00:00.000Z',
        status: 'UNUSED',
        expiresAt: null,
        consumeAt: null,
        pool: 'ADVANCED',
        prizeName: '钢琴代金券',
        prizeType: 'GIFT',
        imageUrl: null,
      },
      {
        id: 'out-newer',
        requestId: 'req-newer',
        nonce: 'fusion:newer',
        createdAt: '2026-07-07T00:00:00.000Z',
        status: 'USED',
        expiresAt: null,
        consumeAt: '2026-07-07T01:00:00.000Z',
        pool: 'SPECIAL',
        prizeName: '自定义礼物券',
        prizeType: 'SELFUSE',
        imageUrl: null,
      },
    ],
    [
      {
        id: 'src-1',
        requestId: 'req-newer',
        sourceKind: 'coupon',
        createdAt: '2026-07-05T00:00:00.000Z',
        consumeAt: '2026-07-07T00:00:00.000Z',
        pool: 'MEDIUM',
        prizeName: '蝴蝶代金券',
        prizeType: 'GIFT',
        imageUrl: null,
      },
      {
        id: 'src-2',
        requestId: 'req-newer',
        sourceKind: 'pointshop',
        createdAt: '2026-07-05T01:00:00.000Z',
        consumeAt: '2026-07-07T00:00:01.000Z',
        pool: 'ADVANCED',
        prizeName: '钢琴代金券',
        prizeType: 'GIFT',
        imageUrl: null,
      },
      {
        id: 'src-3',
        requestId: 'req-newer',
        sourceKind: 'lottery',
        createdAt: '2026-07-05T02:00:00.000Z',
        consumeAt: '2026-07-07T00:00:02.000Z',
        pool: 'SPECIAL',
        prizeName: '自定义tag券',
        prizeType: 'SELFUSE',
        imageUrl: null,
      },
      {
        id: 'src-4',
        requestId: 'req-older',
        sourceKind: 'coupon',
        createdAt: '2026-07-04T02:00:00.000Z',
        consumeAt: '2026-07-06T00:00:02.000Z',
        pool: 'NORMAL',
        prizeName: '香槟代金券',
        prizeType: 'GIFT',
        imageUrl: null,
      },
    ],
  );

  assert.equal(entries[0]?.drawId, 'out-newer');
  assert.equal(entries[0]?.fusionCount, 3);
  assert.equal(entries[0]?.rule?.count, 3);
  assert.deepEqual(
    entries[0]?.sourceItems.map((item) => item.id),
    ['src-1', 'src-2', 'src-3'],
  );
  assert.deepEqual(
    entries[0]?.sourceItems.map((item) => item.sourceKind),
    ['coupon', 'pointshop', 'lottery'],
  );
  assert.equal(entries[1]?.fusionCount, 1);
  assert.equal(entries[1]?.rule, null);
});

test('fusion nonce detection matches output draws only', () => {
  assert.equal(isLotteryFusionNonce('fusion:abc'), true);
  assert.equal(isLotteryFusionNonce('vip:abc'), false);
});

test('source ref helpers round-trip mixed source kinds', () => {
  const ref = buildLotteryFusionSourceRef('pointshop', 'grant-1');
  assert.equal(ref, 'pointshop:grant-1');
  assert.deepEqual(parseLotteryFusionSourceRef(ref), { kind: 'pointshop', id: 'grant-1' });
  assert.deepEqual(parseLotteryFusionSourceRef('draw-1'), { kind: 'lottery', id: 'draw-1' });
});
