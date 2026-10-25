import assert from 'node:assert/strict';
import test from 'node:test';
import { createTargetConfirmationCodec, TargetConfirmationError } from './target-confirmation';
import { createTargetConfirmationService, readTargetConfirmationCaller } from './target-confirmation-service';
import { createTargetConfirmationController, type TargetConfirmationScope } from './target-confirmation-client';

const ownerDiscord = '123456789012345678';
const targetDiscord = '223456789012345678';
const fixedTime = new Date('2026-10-22T12:00:00Z');
const session = { dlmId: 'owner', discordId: ownerDiscord, username: '老板', sessionVersion: 1 };
const caller = { dlmId: 'owner', discordUserId: ownerDiscord };
const giftScope = { purpose: 'gift', target: '7', couponId: 'gift-1', prizeName: '小蛋糕代金券' };

function fixture() {
  // Offline persisted records; there is no Prisma client or mutation method.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = Record<string, any>;
  const identities: Row[] = [
    { dlmId: 'owner', discordUserId: ownerDiscord, sessionVersion: 1, discordDisplayName: '老板', wechatDisplayName: null, member: { discordUserId: ownerDiscord, serverDisplayName: '老板会员名' } },
    { dlmId: 'receiver', discordUserId: targetDiscord, sessionVersion: 1, discordDisplayName: '收礼人', wechatDisplayName: null, member: { discordUserId: targetDiscord, serverDisplayName: '陪玩昵称' } },
    { dlmId: 'payer', discordUserId: null, sessionVersion: 1, discordDisplayName: null, wechatDisplayName: '微信老板', member: null },
  ];
  const voucherBase = { dlmId: 'owner', status: 'ACTIVE', issuedAt: new Date('2026-10-01Z'), expiresAt: new Date('2026-11-01Z'), consumedAt: null, orderId: null };
  const coupons: Row[] = [
    { ...voucherBase, id: 'gift-1', type: 'CAKE_VOUCHER' },
    { ...voucherBase, id: 'flow-1', type: 'DOUBLE_FLOW_5000_VOUCHER' },
    { ...voucherBase, id: 'flow-2', type: 'DOUBLE_FLOW_5000_VOUCHER', expiresAt: new Date('2026-11-02Z') },
    { ...voucherBase, id: 'review-1', type: 'PEIWAN_REVIEW_VOUCHER' },
  ];
  const grants: Row[] = [{ ...voucherBase, id: 'grant-1', deliveryType: 'COUPON', deliveryStatus: 'DELIVERED', couponStatus: 'ACTIVE',
    couponType: 'COMMISSION_MINUS1_VOUCHER', itemName: '抽成降1%券', consumeOrderId: null }];
  const draws: Row[] = [{ id: 'draw-1', dlmId: 'owner', status: 'UNUSED', consumeAt: null, consumeOrderId: null,
    createdAt: new Date('2026-10-01Z'), expiresAt: new Date('2026-11-01Z'), prize: { name: '小蛋糕代金券', type: 'GIFT' } }];
  const profiles: Row[] = [{ PEIWANID: 7, discordUserId: targetDiscord }];
  const reads: Array<{ model: string; where: Row }> = [];
  const hooks: { afterRead?: (model: string, where: Row) => void } = {};
  const matches = (row: Row, where: Row): boolean => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((clause: Row) => matches(row, clause));
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('gt' in value) return actual != null && actual > value.gt;
      return actual != null && matches(actual, value);
    }
    return actual === value;
  });
  const read = (model: string, rows: () => Row[]) => async ({ where, orderBy }: { where: Row; orderBy?: Row[] }) => {
    reads.push({ model, where });
    const candidates = rows().filter(row => matches(row, where));
    if (orderBy) candidates.sort((a, b) => {
      for (const key of orderBy.flatMap(Object.keys)) {
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
      }
      return 0;
    });
    const result = candidates[0] ?? null;
    hooks.afterRead?.(model, where);
    return result;
  };
  const client = {
    dlmUser: { findUnique: read('dlmUser', () => identities) },
    member: { findUnique: read('member', () => identities.flatMap(row => row.member ? [row.member] : [])) },
    pEIWAN: { findUnique: read('pEIWAN', () => profiles) },
    coupon: { findFirst: read('coupon', () => coupons) },
    pointShopGrant: { findFirst: read('pointShopGrant', () => grants) },
    lotteryDraw: { findFirst: read('lotteryDraw', () => draws) },
  } as unknown as Parameters<typeof createTargetConfirmationService>[0]['client'];
  let now = fixedTime.getTime();
  const service = createTargetConfirmationService({ client, codec: createTargetConfirmationCodec({ secret: 'offline-secret', now: () => now }),
    isAdmin: id => id === ownerDiscord, now: () => new Date(now) });
  return { service, client, identities, coupons, grants, draws, profiles, reads, hooks, time: (time: number) => { now = time; } };
}

test('query reads session and actual voucher only, returning fixed target and selected voucher', async () => {
  const f = fixture(); const issued = await f.service.issue(session, giftScope);
  assert.deepEqual(issued.target, { dlmId: 'receiver', discordUserId: targetDiscord, peiwanId: 7, displayName: '陪玩昵称' });
  assert.deepEqual(issued.selectedVoucher, { source: 'coupon', voucherId: 'gift-1', prizeName: '小蛋糕代金券' });
  assert.equal(issued.expiresAt, '2026-10-22T12:05:00.000Z');
  assert.equal(f.coupons[0].status, 'ACTIVE'); assert.equal(f.identities.length, 3);
});
test('consumption resolves only fixed DLM proof and never the old target string', async () => {
  const f = fixture(); const issued = await f.service.issue(session, giftScope); f.reads.length = 0;
  const proof = await f.service.verify(issued.confirmationToken, caller, giftScope);
  assert.equal(proof.target.dlmId, 'receiver');
  assert.ok(f.reads.filter(row => row.model === 'dlmUser').every(row => 'dlmId' in row.where));
  assert.equal(f.reads.filter(row => row.model === 'member').length, 0);
});
test('removed target DLM and reused old Discord never select the replacement account', async () => {
  const f = fixture(); const issued = await f.service.issue(session, giftScope);
  f.identities[1].dlmId = 'replacement'; f.reads.length = 0;
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, giftScope), TargetConfirmationError);
  assert.ok(f.reads.every(row => !('discordUserId' in row.where)));
});
test('target Discord or exact PEIWAN binding changes invalidate confirmation', async () => {
  for (const mutate of [(f: ReturnType<typeof fixture>) => { f.identities[1].discordUserId = '323456789012345678'; },
    (f: ReturnType<typeof fixture>) => { f.profiles[0].discordUserId = ownerDiscord; }]) {
    const f = fixture(); const issued = await f.service.issue(session, giftScope); mutate(f);
    await assert.rejects(f.service.verify(issued.confirmationToken, caller, giftScope), TargetConfirmationError);
  }
});
test('changed caller binding, expired session and legacy session cannot issue another identity', async () => {
  const f = fixture();
  await assert.rejects(readTargetConfirmationCaller(f.client, { ...session, dlmId: null }), TargetConfirmationError);
  await assert.rejects(f.service.issue({ ...session, sessionVersion: 0 }, giftScope), TargetConfirmationError);
  const issued = await f.service.issue(session, giftScope); f.identities[0].discordUserId = '323456789012345678';
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, giftScope), TargetConfirmationError);
});
test('caller merge while query reads target fails the final read-only session recheck', async () => {
  const f = fixture();
  f.hooks.afterRead = (model, where) => { if (model === 'pEIWAN' && where.PEIWANID === 7) f.identities[0].dlmId = 'merged-owner'; };
  await assert.rejects(f.service.issue(session, giftScope), TargetConfirmationError);
});
test('prize-only confirmation preserves selection precedence and pins one exact coupon', async () => {
  const f = fixture(); const scope = { purpose: 'voucher', target: targetDiscord, prizeName: '双倍流水5000券' };
  const issued = await f.service.issue(session, scope);
  assert.equal(issued.selectedVoucher?.voucherId, 'flow-1');
  f.coupons.find(row => row.id === 'flow-1')!.status = 'USED'; f.reads.length = 0;
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, scope), TargetConfirmationError);
  assert.equal(f.coupons.find(row => row.id === 'flow-2')!.status, 'ACTIVE');
  assert.ok(f.reads.filter(row => row.model === 'coupon').every(row => row.where.id === 'flow-1'));
});
test('actual source and prize type reject forged prize names and explicit IDs never pick another voucher', async () => {
  const f = fixture();
  await assert.rejects(f.service.issue(session, { ...giftScope, prizeName: '香水代金券' }), TargetConfirmationError);
  await assert.rejects(f.service.issue(session, { ...giftScope, couponId: 'flow-1', prizeName: '双倍流水5000券' }), TargetConfirmationError);
  await assert.rejects(f.service.issue(session, { purpose: 'voucher', target: '7', couponId: 'missing', prizeName: '双倍流水5000券' }), TargetConfirmationError);
});
test('explicit lottery ID stays lottery and supports a real custom gift prize', async () => {
  const f = fixture(); f.draws[0].prize = { type: 'GIFT', name: '新礼物代金券' };
  const scope = { purpose: 'gift', target: targetDiscord, lotteryId: 'draw-1' };
  const issued = await f.service.issue(session, scope);
  assert.equal(issued.selectedVoucher?.source, 'lottery'); assert.equal(issued.selectedVoucher?.prizeName, '新礼物代金券');
  assert.equal((await f.service.verify(issued.confirmationToken, caller, scope)).selectedVoucher?.voucherId, 'draw-1');
});
test('gift lottery retains the existing no-expiry policy while directed vouchers require an expiry', async () => {
  const f = fixture(); f.draws[0].expiresAt = null;
  const gift = { purpose: 'gift', target: '7', lotteryId: 'draw-1' };
  const issued = await f.service.issue(session, gift);
  assert.ok(await f.service.verify(issued.confirmationToken, caller, gift));
  f.draws[0].prize = { type: 'COUPON', name: '双倍流水5000券' };
  await assert.rejects(f.service.issue(session, { purpose: 'voucher', target: '7', lotteryId: 'draw-1', prizeName: '双倍流水5000券' }), TargetConfirmationError);
});
test('pointshop voucher must remain delivered and available after confirmation', async () => {
  const f = fixture(); const scope = { purpose: 'voucher', target: targetDiscord, couponId: 'grant-1', prizeName: '抽成降1%券' };
  const issued = await f.service.issue(session, scope); assert.equal(issued.selectedVoucher?.source, 'pointshop');
  f.grants[0].deliveryStatus = 'FAILED';
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, scope), TargetConfirmationError);
});
test('review requires fixed PEIWAN even when lookup starts with Discord', async () => {
  const f = fixture(); const scope = { purpose: 'voucher', target: targetDiscord, couponId: 'review-1', prizeName: '陪玩评语券' };
  const issued = await f.service.issue(session, scope); assert.equal(issued.target.peiwanId, 7);
  f.profiles.length = 0;
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, scope), TargetConfirmationError);
});
test('delegated confirmation fixes unbound payer, gift, quantity and operator; payer rebind invalidates it', async () => {
  const f = fixture(); const scope = { purpose: 'delegated-gift', target: '7', payerDlmId: 'payer', giftName: '小蛋糕', quantity: 1.5 };
  const issued = await f.service.issue(session, scope);
  assert.deepEqual(issued.payer, { dlmId: 'payer', discordUserId: null, displayName: '微信老板' });
  assert.equal((await f.service.verify(issued.confirmationToken, caller, scope)).scope.quantity, 1.5);
  f.identities[2].discordUserId = '323456789012345678';
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, scope), TargetConfirmationError);
});
test('non-admin cannot issue a delegated confirmation and legacy missing stable identity cannot query', async () => {
  const f = fixture(); const other = { ...session, dlmId: 'receiver', discordId: targetDiscord };
  await assert.rejects(f.service.issue(other, { purpose: 'delegated-gift', target: '7', payerDlmId: 'payer', giftName: '小蛋糕', quantity: 1 }), error => error instanceof TargetConfirmationError && error.status === 403);
  await assert.rejects(f.service.issue(null, giftScope), error => error instanceof TargetConfirmationError && error.status === 401);
});
test('tampering, changing scope and expiry reject before any database lookup during consumption', async () => {
  const f = fixture(); const issued = await f.service.issue(session, giftScope); f.reads.length = 0;
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, { ...giftScope, couponId: 'flow-1' }), TargetConfirmationError);
  await assert.rejects(f.service.verify(undefined, caller, giftScope), TargetConfirmationError);
  f.time(fixedTime.getTime() + 300000);
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, giftScope), TargetConfirmationError);
  assert.equal(f.reads.length, 0);
});
test('coupon transfer or changed prize after query invalidates exact voucher rather than choosing a new one', async () => {
  for (const mutate of [(f: ReturnType<typeof fixture>) => { f.coupons[0].dlmId = 'receiver'; },
    (f: ReturnType<typeof fixture>) => { f.coupons[0].type = 'PERFUME_VOUCHER'; }]) {
    const f = fixture(); const issued = await f.service.issue(session, giftScope); mutate(f);
    await assert.rejects(f.service.verify(issued.confirmationToken, caller, giftScope), TargetConfirmationError);
  }
});

test('existing cross-table ID collision refuses confirmation even when duplicate belongs to another owner', async () => {
  const f = fixture(); f.grants[0].id = 'gift-1'; f.grants[0].dlmId = 'receiver';
  await assert.rejects(f.service.issue(session, giftScope), error => error instanceof TargetConfirmationError && error.code === 'TARGET_CONFIRMATION_REVIEW_REQUIRED');
  assert.equal(f.coupons[0].status, 'ACTIVE');
});
test('a duplicate source added after confirmation refuses verification without voucher mutation', async () => {
  const f = fixture(); const issued = await f.service.issue(session, giftScope);
  f.draws[0].id = 'gift-1';
  await assert.rejects(f.service.verify(issued.confirmationToken, caller, giftScope), error => error instanceof TargetConfirmationError && error.status === 409 && /管理员核实/.test(error.message));
  assert.equal(f.coupons[0].status, 'ACTIVE'); assert.equal(f.draws[0].status, 'UNUSED');
});

for (const entry of [
  { scope: giftScope, path: '/api/lottery/use', body: { target: '7', prizeName: '小蛋糕代金券', couponId: 'gift-1', mode: 'gift' } },
  { scope: { purpose: 'voucher', target: '7', prizeName: '双倍流水5000券' }, path: '/api/voucher/use', body: { target: '7', prizeName: '双倍流水5000券' } },
  { scope: { purpose: 'delegated-gift', target: '7', payerDlmId: 'payer', giftName: '小蛋糕', quantity: 1.5 }, path: '/api/admin/wechat-bosses/delegated-gift',
    body: { peiwanId: '7', dlmId: 'payer', giftName: '小蛋糕', quantity: 1.5, requestId: 'original-request' } },
]) test(`real browser controller and signer agree for ${entry.scope.purpose}`, async () => {
  const f = fixture(); let submissions = 0;
  const scope = entry.scope as TargetConfirmationScope;
  const controller = createTargetConfirmationController({ now: () => fixedTime.getTime(), fetch: (async (url, init) => {
    const body = JSON.parse(String(init?.body));
    if (url === '/api/profile/target-confirmation') return Response.json(await f.service.issue(session, body));
    assert.equal(url, entry.path);
    const verifiedScope = scope.purpose === 'delegated-gift'
      ? { purpose: 'delegated-gift', target: body.peiwanId, payerDlmId: body.dlmId, giftName: body.giftName, quantity: body.quantity }
      : { purpose: scope.purpose, target: body.target, prizeName: body.prizeName, couponId: body.couponId ?? '', lotteryId: body.lotteryId ?? '' };
    const proof = await f.service.verify(body.confirmationToken, caller, verifiedScope);
    assert.equal(proof.target.dlmId, 'receiver');
    if (scope.purpose === 'voucher') assert.equal(proof.selectedVoucher?.voucherId, 'flow-1');
    submissions++; return Response.json({ ok: true });
  }) as typeof fetch });
  assert.ok(await controller.lookup(scope));
  assert.equal((await controller.submit(scope, entry.path, entry.body)).status, 'success');
  assert.equal(submissions, 1);
});

test('a lost response after verified submission stays unknown and cannot trigger a second effect', async () => {
  const f = fixture(); let effects = 0;
  const scope = giftScope as TargetConfirmationScope;
  const controller = createTargetConfirmationController({ now: () => fixedTime.getTime(), fetch: (async (url, init) => {
    const body = JSON.parse(String(init?.body));
    if (url === '/api/profile/target-confirmation') return Response.json(await f.service.issue(session, body));
    await f.service.verify(body.confirmationToken, caller, giftScope); effects++;
    throw new Error('response lost after commit');
  }) as typeof fetch });
  await controller.lookup(scope);
  const body = { target: '7', prizeName: '小蛋糕代金券', couponId: 'gift-1', mode: 'gift' };
  assert.equal((await controller.submit(scope, '/api/lottery/use', body)).status, 'unknown');
  controller.invalidate(); await controller.lookup(scope);
  assert.equal((await controller.submit(scope, '/api/lottery/use', body)).status, 'blocked');
  assert.equal(effects, 1); assert.match(controller.getSnapshot().message!, /勿重复提交/);
});
