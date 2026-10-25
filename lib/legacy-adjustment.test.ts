/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createLegacyAdjustmentService, AdjustmentOutcomeUnknown } from './legacy-adjustment-core';
import { parseAdjustmentCommand, type AdjustmentCommand } from './legacy-adjustment';
import { handleLegacyAdjustmentRequest } from './legacy-adjustment-request';

const now = new Date('2026-10-24T12:00:00Z'), before = new Date('2026-10-01T12:00:00Z');
const decimalFields = new Set(['income', 'recharge', 'totalBalance', 'totalSpent', 'loyaltyPoints', 'points', 'totalEarn', 'balance', 'balanceBefore', 'balanceAfter', 'amountChange', 'remainingExtra', 'consumeAmount']);
const hydrate = (row: any): any => !row ? null : Object.fromEntries(Object.entries(row).map(([k, v]) => [k, decimalFields.has(k) && v !== null ? new Prisma.Decimal(String(v)) : v]));
const plain = (row: any): any => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Prisma.Decimal.isDecimal(v) ? String(v) : v]));
const same = (a: any, b: any) => a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : String(a) === String(b);
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([k, v]) => k === 'fromMemberId_toMemberId' ? matches(row, v) : same(row[k], v));
}
function wallet(id: string, discord: string | null, income: string, recharge: string) {
  return { dlmId: id, discordUserId: discord, discordDisplayName: id, wechatDisplayName: null, income, recharge, totalBalance: new Prisma.Decimal(income).add(recharge).toString(), totalSpent: '10', loyaltyPoints: '10' };
}
function command(): AdjustmentCommand {
  return { requestId: 'ccad9900-f35d-4b15-9e6f-ad31d135f46c', source: { kind: 'GIFT', id: 'IT-original' },
    proof: '已核对老板付款和陪玩到账凭据，本次退款100并追回陪玩75。', references: ['receipt-1'],
    wallets: [{ dlmId: 'payer', incomeDelta: '0', rechargeDelta: '100', totalSpentDelta: '-100', loyaltyPointsDelta: '-100', earnDelta: '0', rewardIncomeDelta: '0' },
      { dlmId: 'worker', incomeDelta: '-75', rechargeDelta: '0', totalSpentDelta: '0', loyaltyPointsDelta: '0', earnDelta: '-100', rewardIncomeDelta: '-75' }],
    hearts: [{ fromDlmId: 'payer', toDlmId: 'worker', delta: -20 }], vouchers: [], quotas: [],
    reporting: { grossDelta: '-100', payoutDelta: '-75', referralDelta: '0', discountDelta: '0', explanation: '本次退回老板100，追回陪玩75，收益净减25。' } };
}
/** Uses the production callbacks with a closed transactional fixture. Versions
 * simulate database aborts; this is not a PostgreSQL lock-integration test. */
function fixture() {
  const p = wallet('payer', 'payer-dc', '0', '5'), w = wallet('worker', 'worker-dc', '20', '0');
  let state: Record<string, any[]> = {
    dlmUser: [p, w], member: [p, w].map(row => ({ ...row })), pEIWAN: [{ PEIWANID: 7, discordUserId: 'worker-dc', totalEarn: '10', balance: '20' }],
    loyaltyPoint: [{ discordUserId: 'payer-dc', dlmId: 'payer', points: '10' }, { discordUserId: 'worker-dc', dlmId: 'worker', points: '10' }],
    heartCounter: [{ id: 1, fromMemberId: 'payer-dc', toMemberId: 'worker-dc', total: 4 }],
    giftAudit: [{ id: 'audit', auditVersion: 1, individualTransactionId: 'IT-original', paymentTransactionId: 'PAY-original', giverDlmId: null, receiverDlmId: null, createdAt: before }],
    transaction: [{ Transid: 'PAY-original', amount: '100' }],
    individualTransaction: [{ transactionId: 'IT-original', dlmId: 'payer', timeCreatedAt: before, balanceBefore: '105', balanceAfter: '5', amountChange: '100' }],
    order: [{ id: 'order-original', displayNo: 5, status: 'ENDED', createdAt: before }], orderAudit: [],
    revert: [], accountOwnership: [], detachedDiscordAccount: [], coupon: [], lotteryDraw: [], pointShopGrant: [], manualQuotaRestoration: [],
  };
  let version = 0, failModel: string | null = null, loseCommit = false, beforeCommit: (() => void) | null = null;
  const locks: string[] = [];
  function models(draft: typeof state) {
    const result: any = {};
    for (const name of Object.keys(draft)) {
      const rows = draft[name];
      result[name] = {
        async findUnique({ where }: any) { return hydrate(rows.find(row => matches(row, where))); },
        async findMany({ where, take }: any) { return rows.filter(row => matches(row, where)).slice(0, take).map(hydrate); },
        async create({ data }: any) {
          if (name === failModel) throw new Error('offline injected write failure');
          if (name === 'revert' && rows.some(r => r.id === data.id || r.originalTransactionId === data.originalTransactionId)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'offline' });
          const row = { id: `fixture-${name}-${rows.length}`, ...plain(data) }; rows.push(row); return hydrate(row);
        },
        async update({ where, data }: any) {
          if (name === failModel) throw new Error('offline injected write failure');
          const row = rows.find(row => matches(row, where)); if (!row) throw new Error(`missing ${name}`);
          Object.assign(row, plain(data)); return hydrate(row);
        },
        async upsert({ where, create, update }: any) {
          const existing = rows.find(row => matches(row, where)); return existing ? result[name].update({ where, data: update }) : result[name].create({ data: create });
        },
      };
    }
    result.$executeRaw = async (sql: Prisma.Sql | TemplateStringsArray, value?: string) => {
      const text = Array.isArray(sql) ? sql.join('?') : (sql as Prisma.Sql).text;
      locks.push(text.includes('hashtextextended') ? String((sql as Prisma.Sql).values[0]) : text.includes('Order') ? `Order:${value}` : 'other');
      return 1;
    };
    result.$queryRaw = async (sql: Prisma.Sql | TemplateStringsArray, value?: string) => {
      const text = Array.isArray(sql) ? sql.join('?') : (sql as Prisma.Sql).text;
      if (text.includes('FROM "DlmUser"')) { locks.push(`DLM:${value}`); return draft.dlmUser.filter(r => r.dlmId === value).map(hydrate); }
      if (text.includes('FROM "Member"')) { locks.push(`Member:${value}`); return draft.member.filter(r => r.discordUserId === value).map(hydrate); }
      if (text.includes('remaining_extra')) return [{ userId: (sql as Prisma.Sql).values[0], remainingExtra: new Prisma.Decimal(0), expiresAt: new Date(0), createdAt: now }];
      return [{ id: (sql as Prisma.Sql).values?.[0] }];
    };
    return result;
  }
  const db = {
    revert: { findUnique: (args: any) => models(state).revert.findUnique(args) },
    async $transaction(work: (tx: any) => Promise<any>, options: any) {
      assert.ok(['Serializable', 'RepeatableRead'].includes(options.isolationLevel));
      const v = version, draft = structuredClone(state), result = await work(models(draft));
      beforeCommit?.(); beforeCommit = null;
      if (v !== version) throw new Prisma.PrismaClientKnownRequestError('offline serialization abort', { code: 'P2034', clientVersion: 'offline' });
      if (options.isolationLevel === 'Serializable') { state = draft; version++;
        if (loseCommit) { loseCommit = false; throw new Prisma.PrismaClientKnownRequestError('offline connection lost', { code: 'P2028', clientVersion: 'offline' }); }
      }
      return result;
    },
  } as unknown as Pick<PrismaClient, '$transaction' | 'revert'>;
  const service = createLegacyAdjustmentService({ db, isAdmin: id => ['admin', 'admin2'].includes(id), now: () => now });
  return { service, state: () => state, locks, fail: (name: string) => { failModel = name; }, loseCommit: () => { loseCommit = true; }, bumpVersion: () => { beforeCommit = () => { version++; }; } };
}
async function execute(f: ReturnType<typeof fixture>, c = command()) {
  const p = await f.service.preview('admin', c); return f.service.execute('admin', c, p.previewHash, true);
}

test('real callback atomically posts signed wallet/counter effects with independent original evidence', async () => {
  const f = fixture(), original = structuredClone(f.state().giftAudit); await execute(f);
  assert.equal(f.state().dlmUser[0].totalBalance, '105'); assert.equal(f.state().dlmUser[1].income, '-55');
  assert.equal(f.state().pEIWAN[0].totalEarn, '-90'); assert.equal(f.state().heartCounter[0].total, -16);
  assert.equal(f.state().loyaltyPoint[0].points, '-90'); assert.deepEqual(f.state().giftAudit, original);
  const r = f.state().revert[0]; assert.equal(r.status, 'MANUAL_ADJUSTED'); assert.equal(r.createdAt.toISOString(), now.toISOString());
  assert.equal(r.details.source.createdAt, before.toISOString()); assert.equal(r.details.result.wallets[1].rewardIncomeDelta, '-75');
  assert.equal(f.state().individualTransaction.length, 3);
  assert.ok(f.locks.indexOf('original-disposition:IT-original') < f.locks.indexOf('DLM:payer'));
});
test('preview is read only, and caller cannot bypass explicit confirmation or evidence', async () => {
  const f = fixture(), original = structuredClone(f.state()), c = command(); const p = await f.service.preview('admin', c);
  assert.deepEqual(f.state(), original); await assert.rejects(f.service.execute('admin', c, p.previewHash, false), /确认/);
  c.references = []; await assert.rejects(f.service.preview('admin', c), /凭据/); assert.deepEqual(f.state(), original);
});
test('same actor and intent replays the saved result; another actor or changed intent cannot reuse its id', async () => {
  const f = fixture(), c = command(); const p = await f.service.preview('admin', c); const first = await f.service.execute('admin', c, p.previewHash, true);
  assert.deepEqual(await f.service.execute('admin', c, p.previewHash, true), first);
  await assert.rejects(f.service.execute('admin2', c, p.previewHash, true), /请求编号/);
  await assert.rejects(f.service.execute('admin', { ...c, proof: '不同事实' }, p.previewHash, true), /请求编号/);
  assert.equal(f.state().individualTransaction.length, 3);
});
test('all original aliases share the disposition key and any existing status stops another manual handling', async () => {
  for (const status of ['SUCCESS', 'PENDING', 'MANUAL_ADJUSTED']) {
    const f = fixture(); f.state().revert.push({ id: 'prior', originalTransactionId: 'IT-original', status, createdAt: now });
    const c = command(); c.source.id = 'PAY-original'; await assert.rejects(f.service.preview('admin', c), /已有处置/);
  }
});
test('fresh previews of concurrent manual requests cannot post twice', async () => {
  const f = fixture(), a = command(), b = { ...command(), requestId: '17cd0566-04d4-4dca-8685-fcb7fe73e51c' };
  const [pa, pb] = await Promise.all([f.service.preview('admin', a), f.service.preview('admin', b)]);
  const result = await Promise.allSettled([f.service.execute('admin', a, pa.previewHash, true), f.service.execute('admin', b, pb.previewHash, true)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.state().revert.length, 1);
  assert.equal(f.state().individualTransaction.length, 3);
});
for (const model of ['individualTransaction', 'pEIWAN', 'loyaltyPoint', 'heartCounter']) test(`failure in ${model} rolls back marker, balances and previous writes`, async () => {
  const f = fixture(), original = structuredClone(f.state()); f.fail(model); await assert.rejects(execute(f), /injected/); assert.deepEqual(f.state(), original);
});
test('lost commit acknowledgement returns unknown while query/replay finds exactly one original result', async () => {
  const f = fixture(), c = command(), p = await f.service.preview('admin', c); f.loseCommit();
  await assert.rejects(f.service.execute('admin', c, p.previewHash, true), AdjustmentOutcomeUnknown);
  const found = await f.service.query('admin', c.requestId); assert.ok(found);
  assert.deepEqual(await f.service.execute('admin', c, p.previewHash, true), found); assert.equal(f.state().revert.length, 1);
});
test('changed money invalidates preview and known database abort is not reported as success', async () => {
  const f = fixture(), c = command(), p = await f.service.preview('admin', c);
  f.state().dlmUser[0].recharge = f.state().member[0].recharge = '6'; f.state().dlmUser[0].totalBalance = f.state().member[0].totalBalance = '6';
  await assert.rejects(f.service.execute('admin', c, p.previewHash, true), /重新预览/); assert.equal(f.state().revert.length, 0);
  const next = await f.service.preview('admin', c); f.bumpVersion(); await assert.rejects(f.service.execute('admin', c, next.previewHash, true), /并发更新已回滚/); assert.equal(f.state().revert.length, 0);
});
test('original DLM maps to current owner without looking up recycled Discord; mapping changes require new preview', async () => {
  const f = fixture(), c = command(); c.wallets[1].dlmId = 'old-worker'; c.hearts[0].toDlmId = 'old-worker';
  f.state().accountOwnership.push({ identityKind: 'DLM', identityKey: 'old-worker', originalDlmId: 'old-worker', currentDlmId: 'worker' });
  const p = await f.service.preview('admin', c); assert.equal(p.wallets[1].inputDlmId, 'old-worker'); assert.equal(p.wallets[1].dlmId, 'worker');
  await f.service.execute('admin', c, p.previewHash, true); assert.equal(f.state().revert[0].details.result.wallets[1].dlmId, 'worker');
  const g = fixture(), pg = await g.service.preview('admin', command()); g.state().dlmUser[1].discordUserId = 'new-dc';
  await assert.rejects(g.service.execute('admin', command(), pg.previewHash, true)); assert.equal(g.state().revert.length, 0);
});
test('ended order without complete audit is supported; missing or live sources cannot become arbitrary wallet tools', async () => {
  const f = fixture(), c = command(); c.source = { kind: 'ORDER', id: '5' }; await execute(f, c);
  assert.equal(f.state().revert[0].originalTransactionId, 'ORDER:order-original'); assert.equal(f.state().revert[0].details.sourceSnapshot.audit, null);
  assert.ok(f.locks.indexOf('Order:order-original') < f.locks.indexOf('original-disposition:ORDER:order-original'));
  for (const kind of ['GIFT', 'ORDER'] as const) { const g = fixture(); await assert.rejects(g.service.preview('admin', { ...command(), source: { kind, id: 'missing' } }), /找不到/); }
  const g = fixture(); g.state().order[0].status = 'RUNNING'; await assert.rejects(g.service.preview('admin', c), /已结束/);
});
for (const model of ['coupon', 'lotteryDraw', 'pointShopGrant'] as const) test(`${model} restores original lifecycle without extending expiry, including expired history`, async () => {
  for (const expiry of [new Date('2026-11-01T00:00:00Z'), new Date('2026-10-23T00:00:00Z')]) {
    const f = fixture(), c = command(); f.state()[model].push({ id: 'voucher1', dlmId: 'payer', expiresAt: expiry, ...(model === 'coupon' ? { discordId: 'payer-dc', status: 'USED', consumedAt: before, orderId: null } : model === 'lotteryDraw' ? { userId: 'payer-dc', status: 'USED', consumeAt: before, consumeOrderId: null } : { discordUserId: 'payer-dc', deliveryType: 'COUPON', deliveryStatus: 'DELIVERED', couponStatus: 'USED', consumedAt: before, consumeOrderId: null }) });
    c.vouchers = [{ model, id: 'voucher1', ownerDlmId: 'payer', proof: '凭据确认该券本次用于原赠礼' }]; await execute(f, c);
    const row = f.state()[model][0]; assert.equal(row.expiresAt.getTime(), expiry.getTime());
    assert.equal(row.couponStatus ?? row.status, expiry < now ? 'EXPIRED' : model === 'lotteryDraw' ? 'UNUSED' : 'ACTIVE');
  }
});
test('expired quota never revives; valid restored quota keeps the evidenced original expiry', async () => {
  const f = fixture(), c = command(); c.quotas = [
    { ownerDlmId: 'worker', kind: 'flow', amount: '20', expiresAt: '2026-11-01T00:00:00Z', proof: '原额度消费记录明确剩余期限' },
    { ownerDlmId: 'payer', kind: 'spend', amount: '30', expiresAt: '2026-10-23T00:00:00Z', proof: '原额度到期凭据已核实' },
  ]; await execute(f, c); assert.equal(f.state().manualQuotaRestoration.length, 1); assert.equal(f.state().manualQuotaRestoration[0].remainingExtra, '20');
  assert.equal(f.state().revert[0].details.result.quotas[1].restoredAmount, '0');
});
test('classification must be explicit and balance; no fake zero for unknown categories', async () => {
  const f = fixture(), c = command(); c.reporting.grossDelta = null; const p = await f.service.preview('admin', c);
  await assert.rejects(f.service.execute('admin', c, p.previewHash, true), /财务分类/); c.reporting.grossDelta = '0'; await assert.rejects(f.service.preview('admin', c), /净额/);
  assert.equal(f.state().revert.length, 0);
});
test('authority is checked by the core for preview, write and read, not trusted from caller JSON', async () => {
  const f = fixture(); await assert.rejects(f.service.preview('support', command()), /仅管理员/);
  await assert.rejects(f.service.query('support', command().requestId), /仅管理员/);
  await assert.rejects(f.service.execute('support', command(), 'a'.repeat(64), true), /仅管理员/);
  assert.throws(() => parseAdjustmentCommand({ ...command(), wallets: [{ ...command().wallets[0], incomeDelta: '1e3' }] }), /普通数字/);
});
test('route enforces admin/session origin and server actor; lookup never invokes execute', async () => {
  const f = fixture(); let executes = 0;
  const dependencies = { session: async () => ({ discordId: 'support' }), isAdmin: (id: string) => id === 'admin', service: { ...f.service, execute: async (...args: Parameters<typeof f.service.execute>) => { executes++; return f.service.execute(...args); } } };
  assert.equal((await handleLegacyAdjustmentRequest(new Request('https://guild.test/api?requestId=x'), dependencies)).status, 403);
  dependencies.session = async () => ({ discordId: 'admin' });
  const request = (origin: string) => new Request('https://guild.test/api', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'preview', command: command(), actor: 'support' }) });
  assert.equal((await handleLegacyAdjustmentRequest(request('https://evil.test'), dependencies)).status, 403);
  assert.equal((await handleLegacyAdjustmentRequest(request('https://guild.test'), dependencies)).status, 200);
  assert.equal((await handleLegacyAdjustmentRequest(new Request(`https://guild.test/api?requestId=${command().requestId}`), dependencies)).status, 200); assert.equal(executes, 0);
});

test('detached accounts use the latest DLM wallet and retain a before snapshot of the stale parked mirror', async () => {
  const f = fixture(), c = command(); f.state().dlmUser[1].discordUserId = null;
  f.state().detachedDiscordAccount.push({ ownerDlmId: 'worker', memberKey: 'worker-dc' });
  f.state().member[1].income = f.state().member[1].totalBalance = '999';
  await execute(f, c); const w = f.state().revert[0].details.result.wallets[1];
  assert.equal(w.before.income, '20'); assert.equal(w.mirrorsBefore.member.income, '999'); assert.equal(w.after.income, '-55');
  assert.equal(f.state().member[1].income, '-55'); assert.equal(w.discordId, null);
});
test('voucher with a different source lifecycle or unissued shop grant is never restored', async () => {
  for (const model of ['coupon', 'pointShopGrant'] as const) {
    const f = fixture(), c = command(); f.state()[model].push({ id: 'v', dlmId: 'payer', expiresAt: new Date('2026-11-01T00:00:00Z'),
      ...(model === 'coupon' ? { discordId: 'payer-dc', status: 'USED', consumedAt: before, orderId: 'GIFT:other-audit' } : { discordUserId: 'payer-dc', couponStatus: 'USED', consumedAt: before, consumeOrderId: null, deliveryType: 'COUPON', deliveryStatus: 'PENDING' }) });
    c.vouchers = [{ model, id: 'v', ownerDlmId: 'payer', proof: '已核实' }];
    await assert.rejects(f.service.preview('admin', c), /其他原单|不是已发放/); assert.equal(f.state().revert.length, 0);
  }
});
test('permanent lottery voucher retains its original null expiry; no artificial deadline is invented', async () => {
  const f = fixture(), c = command(); f.state().lotteryDraw.push({ id: 'permanent', dlmId: 'payer', userId: 'payer-dc', status: 'USED', consumeAt: before, consumeOrderId: null, expiresAt: null });
  c.vouchers = [{ model: 'lotteryDraw', id: 'permanent', ownerDlmId: 'payer', proof: '原券本次使用凭据确认' }];
  await execute(f, c); assert.equal(f.state().lotteryDraw[0].expiresAt, null); assert.equal(f.state().lotteryDraw[0].status, 'UNUSED');
  assert.equal(f.state().revert[0].details.result.vouchers[0].after.expiresAt, null);
});
test('committed journal carries role follow-up for current owners and only explicit reward deltas', async () => {
  const f = fixture(); await execute(f); const followUp = f.state().revert[0].details.followUp;
  assert.equal(followUp.status, 'PENDING'); assert.deepEqual(followUp.ownerDlmIds, ['payer', 'worker']); assert.deepEqual(followUp.incomeOwnerDlmIds, ['worker']);
  assert.equal(f.state().revert[0].details.result.hearts[0].heartCounterId, 1);
});
