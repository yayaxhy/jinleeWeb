'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { PublicMessageError, publicMessage } from '@/lib/public-error-messages';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  enabled: boolean;
  hasVoicePreview: boolean;
};

const actionBtn =
  'inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] transition disabled:cursor-not-allowed disabled:opacity-60';

export function AuditionInvitePreferenceToggle({ enabled, hasVoicePreview }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const applyPreference = async (nextEnabled: boolean) => {
    if (nextEnabled && !hasVoicePreview) {
      setMessage(siteCopy("site.components.profile.auditioninvitepreferencetoggle.0f9d42f6f3f1"));
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/audition-invite-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new PublicMessageError(typeof data?.error === 'string' ? data.error : '保存失败');
      }
      setMessage(nextEnabled ? siteCopy("site.components.profile.auditioninvitepreferencetoggle.0482396d5f71") : siteCopy("site.components.profile.auditioninvitepreferencetoggle.ff2a3528dcde"));
      router.refresh();
    } catch (err) {
      setMessage(publicMessage(err, '暂时无法保存设置，请刷新查看当前状态或联系客服。'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1 md:max-w-2xl">
          <h3 className="text-lg font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.8ab6fe337e3b" /></h3>
          <p className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.97cdc49e8916" /></p>
          {!hasVoicePreview ? (
            <p className="text-xs text-[#b45309]"><SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.e0e8a8b34079" /></p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {enabled ? <SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.d78cde076b67" /> : <SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.b9004e6f7bb1" />}
          </span>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              disabled={pending || !hasVoicePreview}
              onClick={() => void applyPreference(true)}
              className={`${actionBtn} ${
                enabled
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-black/10 text-gray-600 hover:bg-black/5'
              }`}
            ><SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.e2996777daab" /></button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void applyPreference(false)}
              className={`${actionBtn} ${
                !enabled
                  ? 'border-[#b07d00] bg-[#fff4d6] text-[#8a6000]'
                  : 'border-black/10 text-gray-600 hover:bg-black/5'
              }`}
            ><SiteText copyKey="site.components.profile.auditioninvitepreferencetoggle.99f83883661d" /></button>
          </div>
        </div>
      </div>

      {message ? <p className="text-xs text-gray-500"><SiteText namespace="site.components.profile.auditioninvitepreferencetoggle" value={message} /></p> : null}
    </div>
  );
}
