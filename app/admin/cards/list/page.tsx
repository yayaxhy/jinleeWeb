import Link from 'next/link';
import { PeiwanCardUploader } from '@/components/admin/PeiwanCardUploader';

export const metadata = {
  title: '管理陪玩列表名片',
};

export default function ManagePeiwanListCardsPage() {
  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">管理陪玩列表名片</h2>
          <p className="text-sm text-white/70">
            上传陪玩列表名片，文件会保存到 public/peiwanList/img，若同名则覆盖。
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          返回后台
        </Link>
      </div>

      <PeiwanCardUploader
        title="上传陪玩列表名片"
        description="支持批量选择和上传，建议文件名使用陪玩数字 ID（例如 51106.png）。"
        endpoint="/api/admin/peiwan-cards/list"
        notes={[
          '文件将存储在 public/peiwanList/img 下，同名会被覆盖。',
          '为确保前台正常读取，请使用数字文件名（示例：51106.png、51107.jpg）。',
        ]}
      />
    </div>
  );
}
