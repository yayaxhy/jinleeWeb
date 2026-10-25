import { InternalBotError, postInternalBot } from '@/lib/internal-bot';
import { prisma } from '@/lib/prisma';
import { createGuildNotificationService } from './notification-center-service';
export type { GuildNotificationInput } from './notification-center-service';

const service = createGuildNotificationService({
  db: prisma,
  siteOrigin: () => process.env.SITE_ORIGIN?.trim() || 'https://dlmclub.com',
  async sendDiscord(payload) {
    try {
      const result = await postInternalBot<{ ok?: boolean; notificationId?: string }>('/internal/notifications/discord-dm', payload);
      if (result.ok !== true || result.notificationId !== payload.notificationId) throw new Error('discord_receipt_unknown');
      return { status: 'SENT' };
    } catch (error) {
      if (error instanceof InternalBotError && (
        error.code === 'internal_bot_not_configured' || error.code === 'client_not_ready' ||
        [400, 401, 403, 404, 409, 429].includes(error.status)
      )) return { status: 'FAILED', error: `discord_rejected_${error.status}` };
      throw error;
    }
  },
});

export const { publishGuildNotification, retryGuildNotificationDeliveries, listGuildNotifications, markGuildNotificationsRead } = service;
