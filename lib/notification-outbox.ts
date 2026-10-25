import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export const NOTIFICATION_INTERVAL_MS = 5 * 60_000;
export const NOTIFICATION_MAX_AGE_MS = 24 * 60 * 60_000;
export const NOTIFICATION_MAX_ATTEMPTS = 3;
export const NOTIFICATION_LEASE_MS = 90_000;
export type NotificationOutboxInput = {
  dedupeKey: string; recipientDlmId?: string | null; recipientDiscordId?: string | null;
  event: string; title: string; body: string; href?: string | null;
};
const clean = (value: string | null | undefined, max: number) => String(value ?? '').trim().slice(0, max);

/** Database work only: the caller must pass the same transaction as the business write. */
export async function enqueueNotificationTx(tx: Pick<Prisma.TransactionClient, 'guildNotificationOutbox'>, input: NotificationOutboxInput) {
  const dedupeKey = clean(input.dedupeKey, 255), title = clean(input.title, 160), body = clean(input.body, 1000);
  const recipientDlmId = clean(input.recipientDlmId, 128) || null;
  const recipientDiscordId = clean(input.recipientDiscordId, 32) || null;
  const event = clean(input.event, 80);
  if (!dedupeKey || !title || !body || !event || (!recipientDlmId && !recipientDiscordId)) throw new Error('invalid_notification_payload');
  const href = input.href?.startsWith('/') && !input.href.startsWith('//') ? clean(input.href, 512) : null;
  const payload = { recipientDlmId, recipientDiscordId, event, title, body, href };
  const row = await tx.guildNotificationOutbox.upsert({ where: { dedupeKey },
    create: { id: randomUUID(), dedupeKey, ...payload, ...(recipientDiscordId ? {} : { status: 'SKIPPED', error: 'discord_not_bound' }) }, update: {} });
  // A dedupe collision must never silently reuse somebody else's private message.
  if (Object.entries(payload).some(([key, value]) => row[key as keyof typeof payload] !== value)) throw new Error('notification_dedupe_conflict');
  return row;
}

// Set the canonical migration-installed trigger flag before an explicitly named
// wallet event, so generic fallback cannot create a second private message.
export async function suppressGenericBalanceNoticeTx(tx: Pick<Prisma.TransactionClient, '$executeRaw'>) {
  await tx.$executeRaw`SELECT set_config('bot.skip_recharge_notify', 'true', true)`;
}
