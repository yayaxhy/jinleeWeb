'use client';

import Link from 'next/link';
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
      router.replace('/profile');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '进入失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-12 text-[#171717] sm:py-16">
      <section className="mx-auto max-w-xl">
        <div className="rounded-[32px] border border-black/5 bg-white p-7 shadow-[0_10px_30px_rgba(17,24,39,0.04)] sm:p-8">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400">DLM Club</p>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#d4b24c]/40 bg-gradient-to-br from-[#fff3cf] to-[#ead08a] text-3xl font-semibold text-[#8a6000]">
                D
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-wide">老板个人中心</h1>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">DLM ID 只读查询</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-gray-500">
              输入客服提供的 DLM ID，即可查看余额、积分和全部流水。本入口仅供查询，不能直接消费余额。
            </p>
            <Link
              href="/"
              className="inline-flex rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
            >
              返回主页
            </Link>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4 border-t border-dashed border-black/10 pt-7">
            <label className="block space-y-2 text-sm font-medium text-gray-700">
              <span className="text-xs uppercase tracking-[0.35em] text-gray-500">DLM ID</span>
            <input
              value={dlmId}
              onChange={(event) => setDlmId(event.target.value)}
              autoComplete="off"
              placeholder="dlm..."
              className="w-full rounded-xl border border-black/10 bg-[#fdfcfb] px-4 py-3 text-[#171717] outline-none placeholder:text-gray-400 focus:border-[#d4b24c] focus:ring-2 focus:ring-[#f8c84a]/20"
            />
          </label>
          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
          <button
            disabled={submitting}
            className="w-full rounded-full border border-[#d4b24c]/40 bg-[#f8c84a] px-5 py-3 text-sm font-semibold text-[#5f4500] transition hover:bg-[#f6d66f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '进入中…' : '进入个人中心'}
          </button>
          </form>
        </div>
      </section>
    </main>
  );
}
