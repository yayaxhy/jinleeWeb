import test from 'node:test';
import assert from 'node:assert/strict';
import { giftAuditIdentityFilter, giftHistoryActorMatches } from './gift-history-ownership';
test('admin current-account search includes migrated DLM and generation-bounded legacy audit history', async () => {
  const first = new Date('2025-01-01Z'), second = new Date('2026-01-01Z');
  const rows = [
    { identityKind: 'DLM', identityKey: 'OLD', originalDlmId: 'OLD', currentDlmId: 'NEW', retiredAt: second },
    { identityKind: 'DISCORD', identityKey: '111111111111111111', originalDlmId: 'OLDER', currentDlmId: 'OTHER', retiredAt: first },
    { identityKind: 'DISCORD', identityKey: '111111111111111111', originalDlmId: 'OLD', currentDlmId: 'NEW', retiredAt: second },
  ];
  const db: any = { dlmUser: { findFirst: async () => ({ dlmId: 'NEW' }) }, accountOwnership: { findMany: async ({ where }: any) => rows.filter(row => Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value)) } };
  const where = await giftAuditIdentityFilter(db, { giverId: 'NEW', receiverId: 'NEW' });
  const parts = where.AND as any[];
  assert.deepEqual(parts[0].OR[2], { giverDlmId: { in: ['NEW', 'OLD'] } });
  assert.deepEqual(parts[0].OR[3], { giverDlmId: null, giverId: '111111111111111111', createdAt: { gt: first, lte: second } });
  assert.deepEqual(parts[1].OR[2], { receiverDlmId: { in: ['NEW', 'OLD'] } });
  assert.equal(await giftHistoryActorMatches(db, { dlmId: 'OLD', discordId: '111111111111111111' }, { dlmId: 'NEW', discordId: '999999999999999999' }), true);
  assert.equal(await giftHistoryActorMatches(db, { dlmId: 'OLD', discordId: '111111111111111111' }, { dlmId: 'OTHER', discordId: '111111111111111111' }), false);
});
