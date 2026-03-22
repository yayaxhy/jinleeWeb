'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DisplayMode = 'HIDDEN' | 'ANONYMOUS' | 'REALNAME';

export type PeiwanReviewView = {
  id: string;
  reviewerDiscordId: string;
  reviewerName: string | null;
  content: string;
  displayMode: DisplayMode;
  createdAtLabel: string;
};

type Props = {
  reviews: PeiwanReviewView[];
};

const actionBtn = 'rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold transition';

export function PeiwanReviewManager({ reviews }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyMode = async (reviewId: string, mode: DisplayMode) => {
    setPendingId(reviewId);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/peiwan-reviews/display-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '操作失败');
      }
      setMessage('保存成功');
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setPendingId(null);
    }
  };

  if (reviews.length === 0) {
    return <p className="text-sm text-gray-400">暂无老板评语。</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const reviewerName = review.reviewerName?.trim() || review.reviewerDiscordId;
        const anonymousLabel = review.displayMode === 'ANONYMOUS' ? '卸下评语' : '匿名显示';
        const anonymousTargetMode: DisplayMode = review.displayMode === 'ANONYMOUS' ? 'HIDDEN' : 'ANONYMOUS';
        const realnameLabel = review.displayMode === 'REALNAME' ? '卸下评语' : '实名显示';
        const realnameTargetMode: DisplayMode = review.displayMode === 'REALNAME' ? 'HIDDEN' : 'REALNAME';
        const previewText =
          review.displayMode === 'ANONYMOUS'
            ? `匿名老板评语：${review.content}`
            : review.displayMode === 'REALNAME'
              ? `老板${reviewerName}评语：${review.content}`
              : '当前未展示在名片上';

        return (
          <div
            key={review.id}
            className="rounded-2xl border border-dashed border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-4 space-y-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#171717]">{review.content}</p>
              <p className="text-xs text-gray-500">
                来自：{reviewerName} · 时间：{review.createdAtLabel}
              </p>
              <p className="text-xs text-[#8a6000]">名片预览：{previewText}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void applyMode(review.id, anonymousTargetMode)}
                disabled={pendingId === review.id}
                className={`${actionBtn} ${
                  review.displayMode === 'ANONYMOUS'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'text-gray-600 hover:bg-black/5'
                }`}
              >
                {anonymousLabel}
              </button>
              <button
                type="button"
                onClick={() => void applyMode(review.id, realnameTargetMode)}
                disabled={pendingId === review.id}
                className={`${actionBtn} ${
                  review.displayMode === 'REALNAME'
                    ? 'border-[#b07d00] bg-[#fff4d6] text-[#8a6000]'
                    : 'text-gray-600 hover:bg-black/5'
                }`}
              >
                {realnameLabel}
              </button>
            </div>
          </div>
        );
      })}
      {message ? <p className="text-xs text-gray-500">{message}</p> : null}
    </div>
  );
}
