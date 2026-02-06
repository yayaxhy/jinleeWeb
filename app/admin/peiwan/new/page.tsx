import { redirect } from 'next/navigation';
import { PeiwanForm } from '@/components/admin/PeiwanForm';
import { getServerSession } from '@/lib/session';
import { canManagePeiwan, isHowardReadOnlyDiscordId } from '@/lib/admin';

export const metadata = {
  title: '新增陪玩 - 锦鲤管理后台',
};

export default async function CreatePeiwanPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canManagePeiwan(session.discordId)) {
    redirect('/');
  }
  const readOnly = isHowardReadOnlyDiscordId(session.discordId);

  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">添加陪玩</h2>
        <p className="text-sm text-white/70">请填写 Discord ID 及相关信息，未填写的字段将使用数据库默认值。</p>
      </div>
      <PeiwanForm mode="create" readOnly={readOnly} />
    </div>
  );
}
