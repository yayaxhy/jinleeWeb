import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

test('website checks the Revert marker after locking an order before using a voucher', () => {
  const service = source('app/api/personal/discountService.ts');
  assert.match(service, /await lockOrderForDiscountTx\(tx, order\.id\);\s*const revert = await tx\.revert\.findUnique\(/);
  assert.match(service, /originalTransactionId: `ORDER:\$\{order\.id\}`/);
  assert.match(service, /if \(revert\) return \{ status: 'order_reverted' \}/);
});

test('website does not list reverted orders as eligible for voucher discounts', () => {
  const route = source('app/api/orders/discountable/route.ts');
  assert.match(route, /prisma\.revert\.findMany\(/);
  assert.match(route, /revertedOrders\.forEach\(\(item\) => ineligibleIds\.add\(/);
});
