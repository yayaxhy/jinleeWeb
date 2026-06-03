import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NewHomeContentManager } from '@/components/admin/NewHomeContentManager';
import { isAdminDiscordId } from '@/lib/admin';
import { readNewHomeContentEditorPayload } from '@/lib/newhome-content';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminNewHomePage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const payload = await readNewHomeContentEditorPayload();

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h2 className="text-2xl font-semibold">Newhome 内容编辑器</h2>
          <p className="max-w-3xl text-sm text-white/60">
            这里编辑的是 `/newhome-editable` 和 `/newhome-editable/404` 的运行时内容 JSON。`/newhome`
            现在恢复成原站本地镜像，用来保证 1:1 显示；可维护版保留在 editable 路由继续改内容和布局。
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
        >
          返回后台首页
        </Link>
      </div>

      <NewHomeContentManager
        initialRaw={payload.raw}
        defaultRaw={payload.defaultRaw}
        contentPath={payload.contentPath}
      />
    </div>
  );
}
