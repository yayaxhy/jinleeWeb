'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function DlmPortalLoginPage() {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [dlmId, setDlmId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/dlm/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dlmId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : siteCopy("site.app.dlm.login.page.46441e2429f8"));
      router.replace('/profile');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : siteCopy("site.app.dlm.login.page.46441e2429f8"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-12 text-[#171717] sm:py-16">
      <section className="mx-auto max-w-xl">
        <div className="rounded-[32px] border border-black/5 bg-white p-7 shadow-[0_10px_30px_rgba(17,24,39,0.04)] sm:p-8">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400"><SiteText copyKey="site.app.dlm.login.page.ace0fc50555b" /></p>
            <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.dlm.login.page.6e5f8dc5ce26" /></h1>
            <p className="text-sm leading-6 text-gray-500"><SiteText copyKey="site.app.dlm.login.page.b7cb0a9044b6" /></p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4 border-t border-dashed border-black/10 pt-7">
            <label className="block space-y-2 text-sm font-medium text-gray-700">
              <span className="text-xs uppercase tracking-[0.35em] text-gray-500"><SiteText copyKey="site.app.dlm.login.page.86c67464ba78" /></span>
            <input
              value={dlmId}
              onChange={(event) => setDlmId(event.target.value)}
              autoComplete="off"
              placeholder={siteCopy("site.app.dlm.login.page.64de7ada1fb5")}
              className="w-full rounded-xl border border-black/10 bg-[#fdfcfb] px-4 py-3 text-[#171717] outline-none placeholder:text-gray-400 focus:border-[#d4b24c] focus:ring-2 focus:ring-[#f8c84a]/20"
            />
          </label>
          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"><SiteText namespace="site.app.dlm.login.page" value={error} /></p> : null}
          <button
            disabled={submitting}
            className="w-full rounded-full border border-[#d4b24c]/40 bg-[#f8c84a] px-5 py-3 text-sm font-semibold text-[#5f4500] transition hover:bg-[#f6d66f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <SiteText copyKey="site.app.dlm.login.page.8fdcd0c224f6" /> : <SiteText copyKey="site.app.dlm.login.page.a47d02340b50" />}
          </button>
          </form>
        </div>
      </section>
    </main>
  );
}
