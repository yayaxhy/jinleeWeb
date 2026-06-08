import Link from 'next/link';

type DisplayMode = 'HIDDEN' | 'ANONYMOUS' | 'REALNAME';

const DISPLAY_MODE_META: Record<
  DisplayMode,
  { label: string; badgeClass: string; helper: string }
> = {
  HIDDEN: {
    label: '未展示',
    badgeClass: 'bg-gray-100 text-gray-500',
    helper: '当前未展示在对方名片上',
  },
  ANONYMOUS: {
    label: '匿名展示',
    badgeClass: 'bg-amber-50 text-amber-700',
    helper: '当前以匿名老板评语展示',
  },
  REALNAME: {
    label: '实名展示',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    helper: '当前以实名老板评语展示',
  },
};

export type AuthoredPeiwanReviewView = {
  id: string;
  peiwanDiscordId: string;
  peiwanName: string;
  peiwanId: number | null;
  content: string;
  displayMode: DisplayMode;
  createdAtLabel: string;
};

type Props = {
  reviews: AuthoredPeiwanReviewView[];
};

export function SentPeiwanReviewHistory({ reviews }: Props) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
        <p className="text-sm text-gray-500">你还没有提交过陪玩评语。</p>
        <Link
          href="/profile/bag"
          className="mt-4 inline-flex rounded-full border border-[#e7c56c] bg-[linear-gradient(180deg,_#fff4cc,_#f8df97)] px-4 py-2 text-xs font-semibold text-[#8a6000] transition hover:brightness-105"
        >
          去背包使用评语券
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const statusMeta = DISPLAY_MODE_META[review.displayMode];

        return (
          <div
            key={review.id}
            className="rounded-[28px] border border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 shadow-[0_8px_30px_rgba(17,24,39,0.05)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold text-[#171717]">{review.peiwanName}</p>
                <p className="break-all text-xs text-gray-500">
                  Discord ID: {review.peiwanDiscordId}
                </p>
                <p className="text-xs text-gray-500">
                  {review.peiwanId ? `陪玩 ID ${review.peiwanId}` : '陪玩 ID 未记录'}
                </p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusMeta.badgeClass}`}>
                {statusMeta.label}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[#b07d00]">评语内容</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#171717]">{review.content}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>提交时间：{review.createdAtLabel}</span>
              <span>{statusMeta.helper}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
