import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { loadAccountMigrationBenefits, inheritedAutoCommissionExpiry } from './account-migration-benefits';
const now = new Date('2026-10-24T12:00:00Z'), day = 86400000;
const at = (days: number) => new Date(now.getTime() + days * day);
function fixture() {
  const migrations = [
    { targetDlmId: 'MIDDLE', createdAt: at(-2), inheritedAutoCommissionUntil: at(20), snapshot: { suppressedVipLevels: [2], excludedAutoCommissionTransactionIds: ['gift-old', 'order-old'], excludedAutoCommissionOrigins: [{ dlmIds: ['SOURCE'], through: at(-2).toISOString() }] } },
    { targetDlmId: 'FINAL', createdAt: at(-1), inheritedAutoCommissionUntil: at(5), snapshot: { suppressedVipLevels: [3], excludedAutoCommissionTransactionIds: ['middle-income'] } },
  ];
  const db = {
    dlmUser: { async findUnique() { return { dlmId: 'FINAL' }; } },
    accountOwnership: { async findMany() { return [{ originalDlmId: 'MIDDLE' }]; } },
    accountMigration: { async findMany({ where }: any) { return migrations.filter(row => where.targetDlmId.in.includes(row.targetDlmId)); } },
    revert: { async findMany() { return [
      { details: { originalReceiverTransactionId: 'gift-old', receiverReversalTransactionId: 'gift-return' } },
      { details: { originalWorkerTransactionId: 'order-old', workerReversalTransactionId: 'order-return' } },
      { details: { originalReceiverDlmId: 'SOURCE', originalGiftCreatedAt: at(-3).toISOString(), receiverReversalTransactionId: 'v2-return' } },
      { details: { originalReceiverDlmId: 'FINAL', originalGiftCreatedAt: at(-3).toISOString(), receiverReversalTransactionId: 'target-return' } },
      { details: { originalReceiverDlmId: 'SOURCE', originalGiftCreatedAt: at(1).toISOString(), receiverReversalTransactionId: 'later-return' } },
    ]; } },
  } as unknown as Parameters<typeof loadAccountMigrationBenefits>[0];
  return db;
}
test('chain migration keeps original income exclusions, matching reversals and permanent VIP suppression', async () => {
  const context = await loadAccountMigrationBenefits(fixture(), { discordUserId: 'current' }, now);
  assert.deepEqual([...context.excludedIncomeIds].sort(), ['gift-old', 'gift-return', 'middle-income', 'order-old', 'order-return', 'v2-return']);
  assert.deepEqual([...context.suppressedVipLevels], [2, 3]);
  assert.equal(context.inheritedAutoCommissionUntil?.getTime(), at(20).getTime());
  assert.equal(inheritedAutoCommissionExpiry(at(5), context, now)?.getTime(), at(20).getTime());
  assert.equal(inheritedAutoCommissionExpiry(at(30), context, now)?.getTime(), at(30).getTime());
});
test('expired inherited benefits never revive or extend from the refresh date', async () => {
  const context = await loadAccountMigrationBenefits(fixture(), { dlmId: 'FINAL' }, at(21));
  assert.equal(context.inheritedAutoCommissionUntil, null);
  assert.equal(inheritedAutoCommissionExpiry(null, context, at(21)), null);
  assert.deepEqual([...context.suppressedVipLevels], [2, 3]);
});
