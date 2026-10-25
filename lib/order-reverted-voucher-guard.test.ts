import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { applyDiscountForOrder } from '@/app/api/personal/discountService';
import { discountFixture } from './order-discount-fixture.test-support';
import { prisma } from './prisma';

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

for (const kind of ['coupon', 'pointshop', 'lottery'] as const) {
  test(`website rejects ${kind} when reversal commits before its order lock is acquired`, async (t) => {
    const fixture = discountFixture(kind);
    fixture.hooks.onOrderLock = () => { fixture.state().revert = { id: 'R' }; };
    const checkRevert = t.mock.method(fixture.tx.revert, 'findUnique', async (input: Prisma.RevertFindUniqueArgs) => {
      assert.deepEqual(fixture.locks, ['Order']);
      assert.deepEqual(input.where, { originalTransactionId: 'ORDER:O' });
      return fixture.state().revert;
    });
    const originalTransaction = prisma.$transaction;
    Object.defineProperty(prisma, '$transaction', { value: fixture.deps.db.$transaction, configurable: true, writable: true });
    t.after(() => Object.defineProperty(prisma, '$transaction', { value: originalTransaction, configurable: true, writable: true }));

    // Exercise the public Web service and its real transaction implementation.
    const result = await applyDiscountForOrder({
      orderId: 'O', dlmId: 'H', discordUserId: 'host',
      kind: kind === 'lottery' ? 'lottery' : 'coupon', now: fixture.now,
    });
    assert.equal(result.status, 'order_reverted');
    assert.equal(checkRevert.mock.calls.length, 1);
    assert.equal(fixture.counts.transactions, 1);
    assert.equal(fixture.counts.claims, 0);
    assert.equal(fixture.counts.credits, 0);
    assert.equal(fixture.counts.records, 0);
    assert.equal(fixture.state().wallet.totalBalance.toString(), '100');
    assert.equal(fixture.state().discount, null);
  });
}

test('website does not list reverted orders as eligible for voucher discounts', () => {
  const route = source('app/api/orders/discountable/route.ts');
  assert.match(route, /prisma\.revert\.findMany\(/);
  assert.match(route, /revertedOrders\.forEach\(\(item\) => ineligibleIds\.add\(/);
});
