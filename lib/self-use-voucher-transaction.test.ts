import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { consumeSelfUseVoucherTx } from './self-use-voucher-transaction';
import { DlmWalletIdentityChangedError, type ExpectedDlmWalletIdentity } from './dlm-wallet-lock';

type Row = Record<string, unknown>;
const identity = { dlmId: 'session-owner', discordUserId: '123456789012345678' };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return (condition as Row[]).some((part) => matches(row, part));
    if (condition && typeof condition === 'object') {
      const range = condition as { gt: Date };
      return row[key] instanceof Date && row[key] > range.gt;
    }
    return row[key] === condition;
  });
}
function fixture(source: 'coupon' | 'pointshop' | 'lottery', currentIdentity: ExpectedDlmWalletIdentity = identity) {
  const state = { identity: { ...currentIdentity } as ExpectedDlmWalletIdentity | null };
  const events: string[] = []; const updates: Row[] = [];
  const hooks: { beforeLock?: () => Promise<void>; failWrite?: boolean } = {};
  const row: Row = {
    id: 'voucher', dlmId: currentIdentity.dlmId, status: source === 'lottery' ? 'UNUSED' : 'ACTIVE',
    issuedAt: new Date('2090-01-01'), createdAt: new Date('2090-01-01'), expiresAt: new Date('2099-01-01'),
    consumedAt: null, consumeAt: null, orderId: null, consumeOrderId: null,
    deliveryType: 'COUPON', deliveryStatus: 'DELIVERED', couponStatus: 'ACTIVE',
  };
  const update = async ({ where, data }: { where: Row; data: Row }) => {
    assert(events.includes('reread'), 'voucher mutation must follow locked identity reread');
    if (hooks.failWrite) throw new Error('offline failed write');
    if (!matches(row, where)) return { count: 0 };
    updates.push(data); Object.assign(row, data); return { count: 1 };
  };
  const tx = {
    async $queryRaw(parts: TemplateStringsArray, id: string) {
      if (parts.join('?').includes('"DlmUser"')) {
        events.push(`lock:D:${id}`); await hooks.beforeLock?.(); return state.identity ? [state.identity] : [];
      }
      events.push(`lock:M:${id}`); return [{ discordUserId: id }];
    },
    dlmUser: { async findUnique() { events.push('reread'); return state.identity; } },
    coupon: { updateMany: update }, pointShopGrant: { updateMany: update }, lotteryDraw: { updateMany: update },
  } as unknown as Prisma.TransactionClient;
  const use = (snapshot = currentIdentity) => consumeSelfUseVoucherTx(tx, { identity: snapshot, source, voucherId: 'voucher' });
  return { state, row, events, updates, hooks, use };
}

for (const source of ['coupon', 'pointshop', 'lottery'] as const) {
  test(`${source} self-use locks and checks owner before consuming once with exact target audit`, async () => {
    const f = fixture(source);
    assert.equal((await f.use()).count, 1);
    assert.deepEqual(f.events.slice(0, 3), [`lock:D:${identity.dlmId}`, `lock:M:${identity.discordUserId}`, 'reread']);
    assert.equal(f.row.consumeTargetDlmId, identity.dlmId); assert.equal(f.row.consumeTargetId, identity.discordUserId);
    assert.equal((await f.use()).count, 0); assert.equal(f.updates.length, 1);
  });
}
test('DLM-only self-use remains supported without creating a Discord identity', async () => {
  const f = fixture('coupon', { dlmId: 'web-only', discordUserId: null });
  assert.equal((await f.use()).count, 1);
  assert.deepEqual(f.events, ['lock:D:web-only', 'reread']); assert.equal(f.row.consumeTargetId, null);
});
test('old session owner removed by a merge cannot consume a migrated voucher', async () => {
  const f = fixture('coupon'); f.state.identity = null; f.row.dlmId = 'merged-owner';
  await assert.rejects(f.use(), DlmWalletIdentityChangedError); assert.equal(f.updates.length, 0);
});
test('identity change during lock wait rejects the request without touching the voucher', { timeout: 3000 }, async () => {
  const f = fixture('coupon'); const waiting = deferred(); const release = deferred();
  f.hooks.beforeLock = async () => { waiting.resolve(); await release.promise; };
  const use = f.use(); await waiting.promise;
  f.state.identity = { ...identity, discordUserId: '987654321098765432' }; release.resolve();
  await assert.rejects(use, DlmWalletIdentityChangedError); assert.equal(f.updates.length, 0);
});
test('expiry and changed owner are rechecked at the final CAS', async () => {
  for (const source of ['coupon', 'pointshop', 'lottery'] as const) {
    const expired = fixture(source); expired.row.expiresAt = new Date(0);
    assert.equal((await expired.use()).count, 0);
    const moved = fixture(source); moved.row.dlmId = 'different-owner';
    assert.equal((await moved.use()).count, 0);
  }
});
test('inconsistent ACTIVE/UNUSED but consumed or assigned vouchers are rejected', async () => {
  for (const source of ['coupon', 'pointshop', 'lottery'] as const) {
    const f = fixture(source); f.row[source === 'lottery' ? 'consumeAt' : 'consumedAt'] = new Date();
    assert.equal((await f.use()).count, 0);
    if (source === 'lottery') continue;
    const assigned = fixture(source); assigned.row[source === 'coupon' ? 'orderId' : 'consumeOrderId'] = 'existing-order';
    assert.equal((await assigned.use()).count, 0);
  }
});
test('persistence failure propagates without claiming success or retrying', async () => {
  const f = fixture('coupon'); f.hooks.failWrite = true;
  await assert.rejects(f.use(), /offline failed write/); assert.equal(f.updates.length, 0);
  assert.equal(f.events.filter((value) => value === 'reread').length, 1);
});
