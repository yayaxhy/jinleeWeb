'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  enabled: boolean;
};

const actionBtn =
  'inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] transition disabled:cursor-not-allowed disabled:opacity-60';

export function VipRoleSyncPreferenceToggle({ enabled }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const applyPreference = async (nextEnabled: boolean) => {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/vip-role-sync-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.viprolesyncpreferencetoggle.40525a732872"));
      }
      setMessage(
        nextEnabled ? siteCopy("site.components.profile.viprolesyncpreferencetoggle.ccfffb0123c1") : siteCopy("site.components.profile.viprolesyncpreferencetoggle.1b236994c689"),
      );
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e3b341]/25 bg-gradient-to-br from-[#fff8e1] to-[#ffe9b8] p-5 space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1 md:max-w-2xl">
          <h3 className="text-lg font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.b39c9892ffdf" /></h3>
          <p className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.ec09de22fff0" /></p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {enabled ? <SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.084bef6bb875" /> : <SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.68a420b1a0db" />}
          </span>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => void applyPreference(true)}
              className={`${actionBtn} ${
                enabled
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-black/10 text-gray-600 hover:bg-black/5'
              }`}
            ><SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.a55e9673c5aa" /></button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void applyPreference(false)}
              className={`${actionBtn} ${
                !enabled
                  ? 'border-[#b07d00] bg-[#fff4d6] text-[#8a6000]'
                  : 'border-black/10 text-gray-600 hover:bg-black/5'
              }`}
            ><SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.78449ec9bede" /></button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.viprolesyncpreferencetoggle.27f0abbef227" /></p>
      {message ? <p className="text-xs text-gray-500"><SiteText namespace="site.components.profile.viprolesyncpreferencetoggle" value={message} /></p> : null}
    </div>
  );
}
