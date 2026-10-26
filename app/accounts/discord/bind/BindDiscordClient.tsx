"use client";
import { SiteText } from "@/components/SiteCopyProvider";


import { useEffect, useMemo, useRef } from 'react';

type BindDiscordClientProps = {
  bindToken: string;
};

const buildLoginUrl = (bindToken: string) => {
  if (typeof window === 'undefined') return '/api/discord/login';

  const callbackUrl = `/api/discord/bind/complete?bindToken=${encodeURIComponent(bindToken)}`;
  const target = new URL('/api/discord/login', window.location.origin);
  target.searchParams.set('callbackUrl', callbackUrl);
  return target.toString();
};

export default function BindDiscordClient({ bindToken }: BindDiscordClientProps) {
  const loginUrl = useMemo(() => buildLoginUrl(bindToken), [bindToken]);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    window.location.href = loginUrl;
  }, [loginUrl]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white px-6 text-center">
      <div className="max-w-lg space-y-5">
        <p className="text-xs uppercase tracking-[0.45em] text-white/60"><SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.61ae0af769cb" /></p>
        <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.b4e0baf831b0" /></h1>
        <p className="text-sm leading-7 text-white/70"><SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.245b76347fea" /></p>
        <button
          className="inline-flex items-center justify-center rounded-full bg-[#5865F2] px-8 py-3 text-sm uppercase tracking-[0.4em] hover:bg-[#4753c7] transition"
          onClick={() => {
            window.location.href = loginUrl;
          }}
        ><SiteText copyKey="site.app.accounts.discord.bind.binddiscordclient.60402f3c5e5e" /></button>
      </div>
    </main>
  );
}
