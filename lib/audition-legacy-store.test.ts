import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { auditionLegacyPrismaStore, listAuditionLegacyInvites } from './audition-legacy-store';
import { migrationOwnerFields } from './account-migration-records';
import type { AuditionLegacyCommand, AuditionLegacyInvite } from './audition-legacy-transition';
const A = '100000000000000001', B = '100000000000000002';
const input: AuditionLegacyCommand = { requestId: '12345678-1234-4234-8234-123456789012', inviteId: 'invite1', bossDlmId: 'DLM_B', workerDlmId: 'DLM_A', bossDiscordIdSnapshot: B, workerDiscordIdSnapshot: A, peiwanId: 18, quotedGross: '25.00', evidenceReference: 'ref', evidenceNote: 'checked', confirmedUnpaidAndNotJoined: true };
function invite(): AuditionLegacyInvite { return { id: 'invite1', orderRequestId: 'request1', bossId: B, workerId: A, roomChannelId: 'room1', roomGuildId: 'guild1', bossDlmId: null, workerDlmId: null, bossDiscordIdSnapshot: null, workerDiscordIdSnapshot: null, peiwanId: null, quotedGross: null, status: 'PENDING', failureReason: '', transactionId: null, grossAmount: null, feeAmount: null, netAmount: null, createdAt: '2026-10-24T11:00:00.000Z', updatedAt: '2026-10-24T11:00:00.000Z', expiresAt: '2026-10-24T12:00:00.000Z', acceptedAt: null, joinedAt: null, chargedAt: null, fulfilledAt: null, declinedAt: null, canceledAt: null }; }
test('production adapter locks identities then sorted DLM/Member/profile/invitation in Bot-compatible order', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = { async $queryRaw(parts: TemplateStringsArray, ...values: unknown[]) { calls.push({ sql: parts.join('?'), values }); return []; } } as unknown as Prisma.TransactionClient;
  const store = auditionLegacyPrismaStore(tx); await store.lockRequest(input.requestId); await store.lockParticipantsAndInvite(input);
  assert.ok(calls[0].values[0]?.toString().startsWith('audition-legacy-request:'));
  assert.deepEqual(calls.slice(1, 3).map(c => c.values[0]), [`discord-identity:${A}`, `discord-identity:${B}`]);
  assert.deepEqual(calls.slice(3).map(c => [c.sql.match(/FROM "([^"]+)"/)?.[1], c.values[0]]), [['DlmUser', 'DLM_A'], ['DlmUser', 'DLM_B'], ['Member', A], ['Member', B], ['PEIWAN', 18], ['AuditionInvite', 'invite1']]);
});
test('production adapter mutation data is precisely the six missing metadata fields, with exact original CAS state', async () => {
  let saved: Record<string, unknown> | null = null;
  const tx = { auditionInvite: { async updateMany(args: Record<string, unknown>) { saved = args; return { count: 1 }; } } } as unknown as Prisma.TransactionClient;
  const before = invite(), changes = { bossDlmId: 'DLM_B', workerDlmId: 'DLM_A', bossDiscordIdSnapshot: B, workerDiscordIdSnapshot: A, peiwanId: 18, quotedGross: '25.00' };
  assert.equal(await auditionLegacyPrismaStore(tx).fill(before, changes), true);
  const data = (saved as unknown as { data: Record<string, unknown> }).data, where = (saved as unknown as { where: Record<string, unknown> }).where;
  assert.deepEqual(data, changes); assert.equal(Object.keys(data).length, 6);
  assert.equal(where.failureReason, ''); assert.equal(where.status, 'PENDING'); assert.equal(where.joinedAt, null); assert.equal(where.transactionId, null); assert.equal(where.quotedGross, null); assert.equal(where.roomChannelId, 'room1');
  assert.equal((where.expiresAt as Date).toISOString(), before.expiresAt); assert.ok(!('expiresAt' in data)); assert.ok(!('status' in data));
});
test('production adapter reads profile identity only, never current quote, and gathers payment candidates without writes', async () => {
  const row = invite(); const dates = ['createdAt', 'updatedAt', 'expiresAt'] as const;
  const actual = { ...row, ...Object.fromEntries(dates.map(k => [k, new Date(row[k])])) };
  const reads: Array<[string, unknown]> = [];
  const empty = (name: string) => ({ async findMany(args: unknown) { reads.push([name, args]); return []; } });
  const tx = { auditionInvite: { async findUnique() { return actual; } }, orderRequestLog: { async findUnique() { return null; } }, individualTransaction: empty('ledger'), giftAudit: empty('audit'), transaction: empty('payment'),
    dlmUser: empty('DLM'), member: empty('member'), accountBinding: empty('binding'), accountOwnership: empty('ownership'),
    pEIWAN: { async findUnique(args: unknown) { reads.push(['profile', args]); return { PEIWANID: 18, discordUserId: A }; } },
  } as unknown as Prisma.TransactionClient;
  const loaded = await auditionLegacyPrismaStore(tx).load(input); assert.equal(loaded?.invite.quotedGross, null);
  assert.deepEqual((reads.find(r => r[0] === 'profile')![1] as { select: unknown }).select, { PEIWANID: true, discordUserId: true });
  assert.ok(reads.some(r => r[0] === 'ledger')); assert.ok(reads.some(r => r[0] === 'audit'));
});
test('list selects legacy missing metadata active statuses only and uses bounded pagination', async () => {
  let captured: unknown; const tx = { auditionInvite: { async findMany(args: unknown) { captured = args; return []; } } } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await listAuditionLegacyInvites(tx, 'cursor1'), { rows: [], nextCursor: null });
  const query = captured as { where: { status: unknown; OR: unknown[] }; take: number; skip: number };
  assert.deepEqual(query.where.status, { in: ['PENDING', 'ACCEPTED'] }); assert.equal(query.where.OR.length, 6); assert.equal(query.take, 51); assert.equal(query.skip, 1);
});
test('immutable audit table has no account migration ownership fields or foreign keys', () => {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'AuditionLegacyTransition'); assert.ok(model, 'client must be regenerated from final schema');
  assert.equal(model.fields.filter(f => f.kind === 'object').length, 0);
  const fields = migrationOwnerFields('AuditionLegacyTransition'); assert.equal(fields.dlm.size + fields.member.size + fields.peiwan.size, 0);
});
