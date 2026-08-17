import { AccountProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getMiniProgramAccessToken } from '@/lib/wechat';

type NotificationKind = 'critical' | 'message' | 'dispatch';

const templateIds: Record<NotificationKind, string> = {
  critical: process.env.WECHAT_SUBSCRIBE_CRITICAL_TEMPLATE_ID ?? '',
  message: process.env.WECHAT_SUBSCRIBE_MESSAGE_TEMPLATE_ID ?? '',
  dispatch: process.env.WECHAT_SUBSCRIBE_DISPATCH_TEMPLATE_ID ?? '',
};

const preferenceField: Record<NotificationKind, 'miniCriticalNotifications' | 'miniMessageNotifications' | 'miniDispatchNotifications'> = {
  critical: 'miniCriticalNotifications',
  message: 'miniMessageNotifications',
  dispatch: 'miniDispatchNotifications',
};

function truncate(value: string, maxLength: number) {
  return Array.from(value.trim()).slice(0, maxLength).join('');
}

async function sendSubscribeMessage(openId: string, kind: NotificationKind, title: string, body: string, page: string) {
  const templateId = templateIds[kind];
  if (!templateId) return { sent: false, reason: 'template_not_configured' };
  const accessToken = await getMiniProgramAccessToken();
  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      touser: openId,
      template_id: templateId,
      page,
      miniprogram_state: process.env.WECHAT_MINIPROGRAM_ENV_VERSION ?? 'release',
      lang: 'zh_CN',
      data: {
        thing1: { value: truncate(title, 20) },
        thing2: { value: truncate(body, 20) },
        time3: { value: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) },
      },
    }),
  });
  const payload = await response.json().catch(() => ({})) as { errcode?: number; errmsg?: string };
  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || `wechat_subscribe_send_failed:${response.status}`);
  }
  return { sent: true };
}

export async function notifyMiniProgramUser(
  jinleeId: string | null | undefined,
  kind: NotificationKind,
  title: string,
  body: string,
  page: string,
) {
  if (!jinleeId || !templateIds[kind]) return { sent: false, reason: 'disabled' };
  const user = await prisma.jinleeUser.findUnique({
    where: { jinleeId },
    select: {
      miniCriticalNotifications: true,
      miniMessageNotifications: true,
      miniDispatchNotifications: true,
      accountBindings: {
        where: { provider: AccountProvider.WECHAT_MINIPROGRAM },
        select: { providerUserId: true },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!user || !user[preferenceField[kind]]) return { sent: false, reason: 'preference_disabled' };
  const openId = user.accountBindings[0]?.providerUserId;
  if (!openId) return { sent: false, reason: 'openid_missing' };
  return sendSubscribeMessage(openId, kind, title, body, page);
}

export async function notifyDispatchSubscribers(title: string, body: string) {
  if (!templateIds.dispatch) return;
  const users = await prisma.jinleeUser.findMany({
    where: { miniDispatchNotifications: true, accountBindings: { some: { provider: AccountProvider.WECHAT_MINIPROGRAM } } },
    select: { jinleeId: true },
    take: 500,
  });
  await Promise.allSettled(users.map((user) => notifyMiniProgramUser(user.jinleeId, 'dispatch', title, body, 'pages/favorites/index')));
}
