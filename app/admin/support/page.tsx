import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationDeliveryMonitor } from "@/components/admin/NotificationDeliveryMonitor";
import { SupportInbox } from "@/components/admin/SupportInbox";
import { canViewKefuWorkspace } from "@/lib/admin";
import { getServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewKefuWorkspace(session.discordId))
    redirect("/");
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">公会客服</h2>
          <p className="mt-2 text-sm text-white/60">
            老板从工作台发起的客服会话；回复会同步到小程序消息与订阅通知。
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm"
        >
          返回后台
        </Link>
      </div>
      <NotificationDeliveryMonitor />
      <SupportInbox />
    </main>
  );
}
