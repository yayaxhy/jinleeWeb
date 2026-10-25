import type { PrismaClient, Prisma } from '@prisma/client';
import type { DeliveryPagination } from './notification-delivery-list';
const AGE = 24 * 60 * 60_000;
/** A separate page within the same monitor avoids silently mixing two cursors. */
export async function listOutboxDeliveries(db: Pick<PrismaClient, 'guildNotificationOutbox'>, pagination: DeliveryPagination, now = new Date()) {
  const where: Prisma.GuildNotificationOutboxWhereInput = { status: { not: 'SENT' },
    OR: [{ createdAt: { gt: new Date(now.getTime() - AGE) } }, { status: 'REQUIRES_REVIEW' }] };
  const eligible: Prisma.GuildNotificationOutboxWhereInput = { attempts: { lt: 3 }, createdAt: { gt: new Date(now.getTime() - AGE) },
    nextAttemptAt: { lte: now }, OR: [{ status: { in: ['PENDING', 'FAILED'] } }, { status: 'PROCESSING', leaseUntil: { lte: now } }] };
  const [total, retryableCount] = await Promise.all([db.guildNotificationOutbox.count({ where }), db.guildNotificationOutbox.count({ where: eligible })]);
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize)), page = Math.min(pagination.page, totalPages);
  const rows = await db.guildNotificationOutbox.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page-1)*pagination.pageSize, take: pagination.pageSize });
  return { page, pageSize: pagination.pageSize, total, totalPages, retryableCount, deliveries: rows.map(row => ({
    id: row.id, notificationId: row.id, title: row.title, event: row.event,
    userName: row.recipientDlmId || row.recipientDiscordId || '未绑定 Discord', userDlmId: row.recipientDlmId || '', channel: 'DISCORD',
    status: row.status === 'PROCESSING' || row.error === 'delivery_outcome_unknown' ? 'UNCERTAIN' : row.status,
    attempts: row.attempts, error: row.error, updatedAt: row.updatedAt.toISOString(),
    canRetry: ['PENDING','FAILED','PROCESSING'].includes(row.status) && row.attempts < 3 && row.createdAt.getTime()+AGE > now.getTime()
      && row.nextAttemptAt <= now && (row.status !== 'PROCESSING' || (!!row.leaseUntil && row.leaseUntil <= now)),
  })) };
}
