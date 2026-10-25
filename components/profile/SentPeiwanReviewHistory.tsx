'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import Link from 'next/link';
import { useState, useTransition } from 'react';
import { NoticeBanner } from './NoticeBanner';

type DisplayMode = 'HIDDEN' | 'ANONYMOUS' | 'REALNAME';

const DISPLAY_MODE_META: Record<
  DisplayMode,
  { label: string; badgeClass: string }
> = {
  HIDDEN: {
    label: '未展示',
    badgeClass: 'bg-gray-100 text-gray-500',
  },
  ANONYMOUS: {
    label: '匿名展示中',
    badgeClass: 'bg-amber-50 text-amber-700',
  },
  REALNAME: {
    label: '实名展示',
    badgeClass: 'bg-emerald-50 text-emerald-700',
  },
};

export type AuthoredPeiwanReviewView = {
  id: string;
  peiwanName: string;
  peiwanId: number | null;
  content: string;
  displayMode: DisplayMode;
};

type Props = {
  reviews: AuthoredPeiwanReviewView[];
};

export function SentPeiwanReviewHistory({ reviews }: Props) {
  const siteCopy = useSiteCopy();
  const [items, setItems] = useState(reviews);
  const [notice, setNotice] = useState<{
    level: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (review: AuthoredPeiwanReviewView) => {
    const confirmed = window.confirm(siteCopy("site.components.profile.sentpeiwanreviewhistory.2f670ae9a339", {value1: String(review.peiwanName)}));
    if (!confirmed) return;

    startTransition(async () => {
      setPendingId(review.id);
      setNotice(null);
      try {
        const res = await fetch('/api/profile/peiwan-reviews/authored', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewId: review.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.sentpeiwanreviewhistory.72250c5922f2"));
        }
        setItems((prev) => prev.filter((item) => item.id !== review.id));
        setNotice({ level: 'success', text: siteCopy("site.components.profile.sentpeiwanreviewhistory.3f29d809d5fe", {value1: String(review.peiwanName)}) });
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : siteCopy("site.components.profile.sentpeiwanreviewhistory.b037aaef36cc"),
        });
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.7a667f44f1db" /></h2>
          <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.ec8fc8bea081" /></p>
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.497064be1f41" />{items.length}<SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.bce2ef61514a" /></span>
      </div>

      {notice ? (
        <NoticeBanner level={notice.level} message={siteCopy.text(notice.text, "site.components.profile.sentpeiwanreviewhistory")} onDismiss={() => setNotice(null)} />
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
          <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.bc0741f2d349" /></p>
          <Link
            href="/profile/bag"
            className="mt-4 inline-flex rounded-full border border-[#e7c56c] bg-[linear-gradient(180deg,_#fff4cc,_#f8df97)] px-4 py-2 text-xs font-semibold text-[#8a6000] transition hover:brightness-105"
          ><SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.ce55cf26fcac" /></Link>
        </div>
      ) : null}

      {items.map((review) => {
        const statusMeta = DISPLAY_MODE_META[review.displayMode];

        return (
          <div
            key={review.id}
            className="rounded-[28px] border border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 shadow-[0_8px_30px_rgba(17,24,39,0.05)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold text-[#171717]">{review.peiwanName}</p>
                <p className="text-xs text-gray-500">
                  {review.peiwanId ? <SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.e9c75fc6d94d" values={{value1: String(review.peiwanId)}} /> : <SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.00e8a7cec46c" />}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusMeta.badgeClass}`}>
                  <SiteText namespace="site.components.profile.sentpeiwanreviewhistory" value={statusMeta.label} />
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(review)}
                  disabled={isPending || pendingId === review.id}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingId === review.id ? <SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.60793243146e" /> : <SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.3755f56f2f83" />}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[#b07d00]"><SiteText copyKey="site.components.profile.sentpeiwanreviewhistory.c83032f0b1c0" /></p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#171717]">{review.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
