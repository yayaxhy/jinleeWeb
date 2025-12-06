import Link from 'next/link';
import { PeiwanCardUploader } from '@/components/admin/PeiwanCardUploader';

export const metadata = {
  title: '管理陪玩推荐名片',
};

export default function ManagePeiwanRecommendCardsPage() {
  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">管理陪玩推荐名片</h2>
          <p className="text-sm text-white/70">
            上传前会清空 public/peiwanRecommend，最多选择 8 张图片，建议文件名为数字 ID。
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
        title="上传推荐位名片"
        description="一次最多选择 8 张，上传时会先清空旧的推荐位名片。"
        endpoint="/api/admin/peiwan-cards/recommend"
        maxFiles={8}
        notes={[
          '上传会先清空 public/peiwanRecommend 下的所有文件，再写入新文件。',
          '最多 8 张图片，请控制选择数量，文件名建议使用数字 ID（示例：51116.png）。',
        ]}
        actionLabel="清空并上传"
      />
    </div>
  );
}
