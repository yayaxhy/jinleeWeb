import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { buildGiftIdentityPayload, GiftRequestIdentityError, resolveDelegatedGiftIdentity, resolveGiftTargetIdentity } from './gift-request-identity';

const giver = { dlmId: 'payer-dlm', discordUserId: '111111111111111111' as string | null };
const receiver = { dlmId: 'receiver-dlm', discordUserId: '222222222222222222' };
function fixture() {
  const users = new Map([[giver.dlmId, { ...giver }], [receiver.dlmId, { ...receiver }]]);
  const client = {
    member: { async findUnique({ where }: { where: { discordUserId: string } }) { return where.discordUserId === receiver.discordUserId ? { discordUserId: receiver.discordUserId } : null; } },
    dlmUser: { async findUnique({ where }: { where: { dlmId?: string; discordUserId?: string } }) {
      return where.dlmId ? users.get(where.dlmId) ?? null : [...users.values()].find(value => value.discordUserId === where.discordUserId) ?? null;
    } },
    pEIWAN: { async findUnique({ where }: { where: { PEIWANID?: number; discordUserId?: string } }) {
      return where.PEIWANID === 7 || where.discordUserId === receiver.discordUserId ? { PEIWANID: 7, discordUserId: receiver.discordUserId } : null;
    } },
  } as unknown as Pick<PrismaClient, 'member' | 'dlmUser' | 'pEIWAN'>;
  return { client, users };
}

test('gift voucher payload carries captured session owner and target DLM beside both Discord IDs', async () => {
  const f = fixture(); const target = (await resolveGiftTargetIdentity(f.client, receiver.discordUserId))!;
  assert.deepEqual(buildGiftIdentityPayload(giver, target), {
    giverId: giver.discordUserId, giverDlmId: giver.dlmId, receiverId: receiver.discordUserId, receiverDlmId: receiver.dlmId,
  });
});
test('PEIWAN target includes fixed number and original DLM even after target is replaced', async () => {
  const f = fixture(); const target = (await resolveGiftTargetIdentity(f.client, '7'))!;
  f.users.delete(receiver.dlmId); f.users.set('new-account', { ...receiver, dlmId: 'new-account' });
  const payload = buildGiftIdentityPayload(giver, target);
  assert.equal(payload.receiverDlmId, receiver.dlmId); assert.equal(payload.receiverPeiwanId, 7);
});
test('missing target DLM cannot be reconstructed from the old Discord', async () => {
  const f = fixture(); f.users.delete(receiver.dlmId);
  await assert.rejects(resolveGiftTargetIdentity(f.client, '7'), GiftRequestIdentityError);
});
test('delegated linked payer uses fixed DLM and currently captured Discord evidence', async () => {
  const f = fixture();
  assert.deepEqual(await resolveDelegatedGiftIdentity(f.client, giver.dlmId, '7'), {
    giverId: giver.discordUserId, giverDlmId: giver.dlmId, receiverId: receiver.discordUserId,
    receiverDlmId: receiver.dlmId, receiverPeiwanId: 7, peiwanId: '7',
  });
});
test('delegated DLM-only payer explicitly transmits null and never fabricates a Discord', async () => {
  const f = fixture(); f.users.get(giver.dlmId)!.discordUserId = null;
  const payload = await resolveDelegatedGiftIdentity(f.client, giver.dlmId, receiver.discordUserId);
  assert.equal(payload.giverId, null); assert.equal(payload.giverDlmId, giver.dlmId); assert.equal(payload.receiverPeiwanId, 7);
  assert.throws(() => buildGiftIdentityPayload({ ...giver, discordUserId: null }, receiver), GiftRequestIdentityError);
});
test('merged away delegated payer and missing PEIWAN receiver fail before sending to Bot', async () => {
  const f = fixture(); f.users.delete(giver.dlmId);
  await assert.rejects(resolveDelegatedGiftIdentity(f.client, giver.dlmId, '7'), GiftRequestIdentityError);
  await assert.rejects(resolveDelegatedGiftIdentity(f.client, receiver.dlmId, '404'), GiftRequestIdentityError);
});
