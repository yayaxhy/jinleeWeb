import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { buildVoucherIdentityPayload, resolveVoucherTargetIdentity, VoucherRequestIdentityError } from './voucher-request-identity';

const discordUserId = '123456789012345678';
function fixture() {
  const members = new Set([discordUserId]);
  const identities = new Map([[discordUserId, { dlmId: 'target-dlm', discordUserId }]]);
  const peiwan = new Map([[7, { PEIWANID: 7, discordUserId }]]);
  const lookups: string[] = [];
  const client = {
    member: { async findUnique({ where }: { where: { discordUserId: string } }) { return members.has(where.discordUserId) ? { discordUserId: where.discordUserId } : null; } },
    dlmUser: { async findUnique({ where }: { where: { discordUserId: string } }) { return identities.get(where.discordUserId) ?? null; } },
    pEIWAN: { async findUnique({ where }: { where: { PEIWANID?: number; discordUserId?: string } }) {
      lookups.push(JSON.stringify(where));
      return where.PEIWANID ? peiwan.get(where.PEIWANID) ?? null : [...peiwan.values()].find((row) => row.discordUserId === where.discordUserId) ?? null;
    } },
  } as unknown as Pick<PrismaClient, 'member' | 'pEIWAN' | 'dlmUser'>;
  return { members, identities, peiwan, lookups, client };
}

test('Discord snowflake input captures current DLM without converting it to a PEIWAN number', async () => {
  const f = fixture(); const target = await resolveVoucherTargetIdentity(f.client, discordUserId);
  assert.deepEqual(target, { dlmId: 'target-dlm', discordUserId }); assert.equal(f.lookups.length, 0);
});
test('PEIWAN input carries the exact number and Discord with the fixed DLM', async () => {
  const f = fixture();
  assert.deepEqual(await resolveVoucherTargetIdentity(f.client, '7'), { dlmId: 'target-dlm', discordUserId, peiwanId: 7 });
});
test('review resolved through Discord includes the actual PEIWAN number', async () => {
  const f = fixture();
  assert.deepEqual(await resolveVoucherTargetIdentity(f.client, discordUserId, true), { dlmId: 'target-dlm', discordUserId, peiwanId: 7 });
  f.peiwan.clear(); assert.equal(await resolveVoucherTargetIdentity(f.client, discordUserId, true), null);
});
test('missing target DLM fails closed and never creates an account from the Discord', async () => {
  const f = fixture(); f.identities.clear();
  await assert.rejects(resolveVoucherTargetIdentity(f.client, discordUserId), VoucherRequestIdentityError);
});
test('non-Discord archived identifiers and unsafe numeric input are not targets', async () => {
  const f = fixture(); f.members.add('archive-old');
  assert.equal(await resolveVoucherTargetIdentity(f.client, 'archive-old'), null);
  assert.equal(await resolveVoucherTargetIdentity(f.client, '999999999999999999999'), null);
  assert.equal(await resolveVoucherTargetIdentity(f.client, ''), null);
});
test('payload retains session owner identity and resolved target snapshot across subsequent binding changes', async () => {
  const f = fixture(); const target = (await resolveVoucherTargetIdentity(f.client, '7'))!;
  f.identities.set(discordUserId, { dlmId: 'replacement-account', discordUserId });
  assert.deepEqual(buildVoucherIdentityPayload({ dlmId: 'old-session-dlm', discordUserId: '999999999999999999' }, target), {
    userId: '999999999999999999', userDlmId: 'old-session-dlm',
    targetDiscordId: discordUserId, targetDlmId: 'target-dlm', peiwanId: 7,
  });
});
test('self payload includes fixed owner DLM and rejects an unbound owner', () => {
  assert.deepEqual(buildVoucherIdentityPayload({ dlmId: 'owner', discordUserId }), { userId: discordUserId, userDlmId: 'owner' });
  assert.throws(() => buildVoucherIdentityPayload({ dlmId: 'owner', discordUserId: null }), VoucherRequestIdentityError);
});
