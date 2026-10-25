'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";

import { useState } from 'react';
export default function BindDiscordClient({ bindToken }: { bindToken: string }) {
  const siteCopy = useSiteCopy();
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  async function start() {
    if (pending) return; setPending(true); setError('');
    try {
      const response = await fetch(`/api/discord/change/start?bindToken=${encodeURIComponent(bindToken)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.authorizeUrl) throw new Error(result.error ?? siteCopy("site.app.accounts.discord.bind.binddiscordclient.009dac9c626a"));
      window.location.assign(result.authorizeUrl);
    } catch (error) { setError(error instanceof Error ? error.message : siteCopy("site.app.accounts.discord.bind.binddiscordclient.009dac9c626a")); setPending(false); }
  }
  return <main className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6"><section className="max-w-lg space-y-5">
    <h1 className="text-2xl font-semibold"><SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.d769c865e545" /></h1>
    <p><SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.be2b3be4b21c" /></p>
    <button disabled={pending} onClick={start} className="rounded-xl bg-indigo-600 px-6 py-3 disabled:opacity-50">{pending ? <SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.e82601e534cf" /> : <SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.4b69ffb7ff99" />}</button>
    {error && <p role="alert" className="text-red-300"><SiteText namespace="site.app.accounts.discord.bind.binddiscordclient" value={error} /></p>}
  </section></main>;
}
