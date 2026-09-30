'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function DlmPortalLoginPage() {
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
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '进入失败，请稍后重试。');
      router.replace('/dlm/profile');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '进入失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020204] px-6 py-16 text-white">
      <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl shadow-black/40">
        <p className="text-xs tracking-[0.35em] text-white/50">DLM CLUB</p>
        <h1 className="mt-3 text-3xl font-semibold">老板个人中心</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          输入客服提供的 DLM ID，即可查看自己的余额、积分和全部流水。本入口仅供查询，不能直接消费余额。
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block space-y-2 text-sm text-white/80">
            <span>DLM ID</span>
            <input
              value={dlmId}
              onChange={(event) => setDlmId(event.target.value)}
              autoComplete="off"
              placeholder="dlm..."
              className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#9b7ee8]"
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            disabled={submitting}
            className="w-full rounded-full bg-[#7356c6] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#8669d7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '进入中…' : '进入个人中心'}
          </button>
        </form>
      </section>
    </main>
  );
}
