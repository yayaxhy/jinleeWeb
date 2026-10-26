import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { applyDiscountForOrder } from '@/app/api/personal/discountService';
import { prisma } from './prisma';

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

for (const kind of ['coupon', 'pointshop', 'lottery'] as const) {
  test(`website rejects ${kind} when reversal commits before its order lock is acquired`, async (t) => {
    const events: string[] = [];
    let revertCommitted = false;
    let transactions = 0;
    const tx = new Proxy({
      $executeRaw: async (query: TemplateStringsArray, orderId: string) => {
        assert.match(query.join(''), /FROM "Order".*FOR UPDATE/);
        assert.equal(orderId, 'O');
        events.push('lock');
        // The reversal commits while this request waits for the order lock.
        revertCommitted = true;
        return 1;
      },
      order: { findUnique: async () => {
        events.push('order');
        return { id: 'O', hostDlmId: 'H', hostId: 'host', workerId: 'worker',
          status: 'ENDED', createdAt: new Date('2026-10-22T12:00:00Z') };
      } },
      revert: { findUnique: async (input: Prisma.RevertFindUniqueArgs) => {
        assert.deepEqual(events, ['lock', 'order']);
        assert.deepEqual(input.where, { originalTransactionId: 'ORDER:O' });
        events.push('revert');
        return revertCommitted ? { id: 'R' } : null;
      } },
    }, { get(target, property, receiver) {
      assert.ok(Object.hasOwn(target, property), `unexpected database access: ${String(property)}`);
      return Reflect.get(target, property, receiver);
    } }) as unknown as Prisma.TransactionClient;
    const originalTransaction = prisma.$transaction;
    const transaction = async (work: (client: Prisma.TransactionClient) => Promise<unknown>) => {
      transactions++;
      return work(tx);
    };
    Object.defineProperty(prisma, '$transaction', { value: transaction, configurable: true, writable: true });
    t.after(() => Object.defineProperty(prisma, '$transaction', { value: originalTransaction, configurable: true, writable: true }));

    // Exercise the public Web service and its real transaction implementation.
    const result = await applyDiscountForOrder({
      orderId: 'O', dlmId: 'H', discordUserId: 'host',
      kind: kind === 'lottery' ? 'lottery' : 'coupon', now: new Date('2026-10-22T12:00:00Z'),
    });
    assert.equal(result.status, 'order_reverted');
    assert.equal(transactions, 1);
    // No wallet, voucher, audit, or ledger access is permitted after rejection.
    assert.deepEqual(events, ['lock', 'order', 'revert']);
  });
}

test('website does not list reverted orders as eligible for voucher discounts', () => {
  const route = source('app/api/orders/discountable/route.ts');
  assert.match(route, /prisma\.revert\.findMany\(/);
  assert.match(route, /revertedOrders\.forEach\(\(item\) => ineligibleIds\.add\(/);
});
