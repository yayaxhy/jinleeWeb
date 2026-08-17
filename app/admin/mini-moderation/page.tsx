import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canViewTransactions } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function MiniModerationPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewTransactions(session.discordId)) redirect('/');

  const events = await prisma.miniMessageModerationEvent.findMany({
    include: { message: { include: { senderJinleeUser: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">小程序聊天审核</h2>
          <p className="mt-2 text-sm text-white/60">完整原文、自动拦截结果、预警投递和人工处理状态。</p>
        </div>
        <Link href="/admin" className="rounded-xl border border-white/15 px-4 py-2 text-sm">返回后台</Link>
      </div>

      <div className="space-y-4">
        {events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${event.action === 'BLOCK' ? 'bg-red-500/20 text-red-200' : 'bg-amber-500/20 text-amber-100'}`}>
                  {event.action}
                </span>
                <span className="text-sm text-white/60">{event.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
              </div>
              <span className="text-xs text-white/50">{event.notifiedAt ? '预警已送达' : event.notificationError ? `预警失败：${event.notificationError}` : '等待预警'}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-black/20 p-4 text-base text-white">{event.rawText}</p>
            <div className="mt-3 grid gap-2 text-sm text-white/60 md:grid-cols-2">
              <span>原因：{event.reason || '未填写'}</span>
              <span>发送者：{event.message?.senderJinleeUser?.discordDisplayName || event.message?.senderJinleeUser?.wechatDisplayName || event.message?.senderJinleeId || '未知'}</span>
              <span>会话：{event.conversationId || '未知'}</span>
              <span>事件：{event.id}</span>
            </div>
            <div className="mt-4">
              {event.reviewedAt ? (
                <span className="text-sm text-emerald-300">已处理：{event.reviewedAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
              ) : (
                <form action={`/api/admin/mini-moderation/${event.id}/review`} method="post">
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black" type="submit">标记已处理</button>
                </form>
              )}
            </div>
          </article>
        ))}
        {!events.length ? <div className="rounded-2xl border border-white/10 p-8 text-center text-white/60">暂无聊天预警。</div> : null}
      </div>
    </main>
  );
}
