import { Prisma, type PrismaClient, type AuditionInvite } from '@prisma/client';
import { createAuditionLegacyService, auditionLegacyBlockers, type AuditionLegacyEvidence, type AuditionLegacyInvite,
  type AuditionLegacyReceipt, type AuditionLegacyStore } from './audition-legacy-transition';

type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
function inviteView(row: AuditionInvite): AuditionLegacyInvite {
  return { id: row.id, orderRequestId: row.orderRequestId, bossId: row.bossId, workerId: row.workerId, roomChannelId: row.roomChannelId, roomGuildId: row.roomGuildId,
    bossDlmId: row.bossDlmId, workerDlmId: row.workerDlmId, bossDiscordIdSnapshot: row.bossDiscordIdSnapshot, workerDiscordIdSnapshot: row.workerDiscordIdSnapshot,
    peiwanId: row.peiwanId, quotedGross: row.quotedGross?.toString() ?? null, status: row.status, failureReason: row.failureReason,
    transactionId: row.transactionId, grossAmount: row.grossAmount?.toString() ?? null, feeAmount: row.feeAmount?.toString() ?? null, netAmount: row.netAmount?.toString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null, joinedAt: row.joinedAt?.toISOString() ?? null, chargedAt: row.chargedAt?.toISOString() ?? null,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null, declinedAt: row.declinedAt?.toISOString() ?? null, canceledAt: row.canceledAt?.toISOString() ?? null };
}
/** Candidate receipts are deliberately conservative: absence is not proof of no
 * debit. The administrator must also identify reliable original evidence. */
export async function loadAuditionLegacyEvidence(tx: Tx, inviteId: string): Promise<AuditionLegacyEvidence | null> {
  const row = await tx.auditionInvite.findUnique({ where: { id: inviteId } });
  if (!row) return null;
  const [request, ledgers, audits] = await Promise.all([
    tx.orderRequestLog.findUnique({ where: { orderId: row.orderRequestId }, select: { orderId: true, ownerId: true, createdAt: true } }),
    tx.individualTransaction.findMany({ where: { timeCreatedAt: { gte: row.createdAt }, OR: [
      { discordId: row.bossId, thirdPartydiscordId: row.workerId, typeOfTransaction: '试音花费' },
      { discordId: row.workerId, thirdPartydiscordId: row.bossId, typeOfTransaction: '试音收入' },
    ] }, orderBy: { timeCreatedAt: 'asc' }, take: 21, select: { transactionId: true, typeOfTransaction: true, timeCreatedAt: true, amountChange: true } }),
    tx.giftAudit.findMany({ where: { giftName: '真人试音', giverId: row.bossId, receiverId: row.workerId, createdAt: { gte: row.createdAt } },
      orderBy: { createdAt: 'asc' }, take: 21, select: { id: true, paymentTransactionId: true, createdAt: true } }),
  ]);
  const paymentIds = [...new Set([row.transactionId, ...audits.map(a => a.paymentTransactionId)].filter((v): v is string => !!v))];
  const payments = paymentIds.length ? await tx.transaction.findMany({ where: { Transid: { in: paymentIds } }, select: { Transid: true, createdAt: true } }) : [];
  return { invite: inviteView(row), request: request ? { ...request, createdAt: request.createdAt.toISOString() } : null,
    ledgers: ledgers.map(r => ({ transactionId: r.transactionId, type: r.typeOfTransaction, createdAt: r.timeCreatedAt.toISOString(), amount: r.amountChange.toString() })),
    audits: audits.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    payments: payments.map(r => ({ transactionId: r.Transid, createdAt: r.createdAt.toISOString() })) };
}
export function auditionLegacyPrismaStore(tx: Tx): AuditionLegacyStore {
  const receipt = async (where: { requestId: string } | { inviteId: string }) => {
    const row = await tx.auditionLegacyTransition.findUnique({ where });
    return row ? { ...row, createdAt: row.createdAt.toISOString() } as unknown as AuditionLegacyReceipt : null;
  };
  return {
    lockRequest: async id => { await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`audition-legacy-request:${id}`}, 0))`; },
    async lockParticipantsAndInvite(command) {
      for (const dc of [command.bossDiscordIdSnapshot, command.workerDiscordIdSnapshot].sort()) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`discord-identity:${dc}`}, 0))`;
      }
      for (const id of [command.bossDlmId, command.workerDlmId].sort()) await tx.$queryRaw`SELECT "dlmId" FROM "DlmUser" WHERE "dlmId" = ${id} FOR UPDATE`;
      for (const dc of [command.bossDiscordIdSnapshot, command.workerDiscordIdSnapshot].sort()) await tx.$queryRaw`SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${dc} FOR UPDATE`;
      await tx.$queryRaw`SELECT "PEIWANID" FROM "PEIWAN" WHERE "PEIWANID" = ${command.peiwanId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "AuditionInvite" WHERE "id" = ${command.inviteId} FOR UPDATE`;
    },
    receipt: id => receipt({ requestId: id }), receiptForInvite: id => receipt({ inviteId: id }),
    async load(command) {
      const evidence = await loadAuditionLegacyEvidence(tx, command.inviteId); if (!evidence) return null;
      const dlms = [command.bossDlmId, command.workerDlmId], dcs = [command.bossDiscordIdSnapshot, command.workerDiscordIdSnapshot];
      const [accounts, members, bindings, profile, ownership] = await Promise.all([
        tx.dlmUser.findMany({ where: { OR: [{ dlmId: { in: dlms } }, { discordUserId: { in: dcs } }] }, select: { dlmId: true, discordUserId: true }, orderBy: { dlmId: 'asc' } }),
        tx.member.findMany({ where: { discordUserId: { in: dcs } }, select: { discordUserId: true }, orderBy: { discordUserId: 'asc' } }),
        tx.accountBinding.findMany({ where: { provider: 'DISCORD', OR: [{ dlmId: { in: dlms } }, { providerUserId: { in: dcs } }] }, select: { dlmId: true, providerUserId: true }, orderBy: { providerUserId: 'asc' } }),
        tx.pEIWAN.findUnique({ where: { PEIWANID: command.peiwanId }, select: { PEIWANID: true, discordUserId: true } }),
        tx.accountOwnership.findMany({ where: { retiredAt: { gte: new Date(evidence.invite.createdAt) }, OR: [
          { identityKind: 'DLM', identityKey: { in: dlms } }, { identityKind: 'DISCORD', identityKey: { in: dcs } },
        ] }, select: { identityKind: true, identityKey: true, originalDlmId: true, retiredAt: true }, orderBy: { id: 'asc' } }),
      ]);
      return { ...evidence, accounts, members: members.map(m => m.discordUserId), bindings, profile,
        ownership: ownership.map(r => ({ ...r, retiredAt: r.retiredAt.toISOString() })) };
    },
    async fill(before, changes) {
      // CAS repeats every status/settlement guard as well as each original field.
      const result = await tx.auditionInvite.updateMany({ where: {
        id: before.id, updatedAt: new Date(before.updatedAt), status: before.status as AuditionInvite['status'],
        bossId: before.bossId, workerId: before.workerId, roomChannelId: before.roomChannelId, roomGuildId: before.roomGuildId, bossDlmId: before.bossDlmId, workerDlmId: before.workerDlmId,
        bossDiscordIdSnapshot: before.bossDiscordIdSnapshot, workerDiscordIdSnapshot: before.workerDiscordIdSnapshot,
        peiwanId: before.peiwanId, quotedGross: before.quotedGross, expiresAt: new Date(before.expiresAt),
        acceptedAt: before.acceptedAt ? new Date(before.acceptedAt) : null, failureReason: before.failureReason,
        transactionId: null, joinedAt: null, chargedAt: null, fulfilledAt: null, declinedAt: null, canceledAt: null,
        grossAmount: null, feeAmount: null, netAmount: null,
      }, data: changes as Prisma.AuditionInviteUpdateManyMutationInput });
      return result.count === 1;
    },
    async save(receipt) {
      await tx.auditionLegacyTransition.create({ data: { ...receipt, beforeSnapshot: json(receipt.beforeSnapshot), afterSnapshot: json(receipt.afterSnapshot), createdAt: new Date(receipt.createdAt) } });
    },
  };
}
export function prismaAuditionLegacyService(prisma: Pick<PrismaClient, '$transaction'>) {
  return createAuditionLegacyService({ transaction: body => prisma.$transaction(tx => body(auditionLegacyPrismaStore(tx)), { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }) });
}
export async function listAuditionLegacyInvites(tx: Tx, cursor?: string) {
  const rows = await tx.auditionInvite.findMany({ where: { status: { in: ['PENDING', 'ACCEPTED'] }, OR: [
    { bossDlmId: null }, { workerDlmId: null }, { bossDiscordIdSnapshot: null }, { workerDiscordIdSnapshot: null }, { peiwanId: null }, { quotedGross: null },
  ] }, orderBy: { id: 'asc' }, take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  return { rows: rows.slice(0, 50).map(inviteView), nextCursor: rows.length > 50 ? rows[49].id : null };
}
export async function auditionLegacyEvidenceView(tx: Tx, id: string) {
  const evidence = await loadAuditionLegacyEvidence(tx, id);
  if (!evidence) return null;
  const receipt = await tx.auditionLegacyTransition.findUnique({ where: { inviteId: id }, select: { requestId: true, createdAt: true } });
  return { ...evidence, blockers: auditionLegacyBlockers(evidence, new Date()), receipt: receipt ? { ...receipt, createdAt: receipt.createdAt.toISOString() } : null };
}
