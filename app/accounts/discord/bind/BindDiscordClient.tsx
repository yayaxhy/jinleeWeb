"use client";

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
        <p className="text-xs uppercase tracking-[0.45em] text-white/60">Discord Binding</p>
        <h1 className="text-3xl font-semibold tracking-wide">正在跳转 Discord 绑定…</h1>
        <p className="text-sm leading-7 text-white/70">
          如果浏览器没有自动跳转，请点击下面的按钮继续。完成 Discord 授权后，系统会自动把当前微信账号和 Discord
          账号合并成同一个业务用户。
        </p>
        <button
          className="inline-flex items-center justify-center rounded-full bg-[#5865F2] px-8 py-3 text-sm uppercase tracking-[0.4em] hover:bg-[#4753c7] transition"
          onClick={() => {
            window.location.href = loginUrl;
          }}
        >
          Continue with Discord
        </button>
      </div>
    </main>
  );
}
