'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminPeiwanActions() {
  const router = useRouter();
  const [editDiscordId, setEditDiscordId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetId = editDiscordId.trim();
    if (!targetId) {
      setError('请输入 Discord ID 或陪玩ID');
      return;
    }
    setError(null);
    router.push(`/admin/peiwan/${encodeURIComponent(targetId)}`);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h3 className="text-xl font-semibold">新增陪玩</h3>
        <p className="text-sm text-white/70">填完表单即可创建新的陪玩账号信息。</p>
        <Link
          href="/admin/peiwan/new"
          className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
        >
          前往新增
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h3 className="text-xl font-semibold">修改陪玩信息</h3>
        <p className="text-sm text-white/70">输入 Discord ID 或陪玩ID，跳转到对应的编辑页面。</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={editDiscordId}
            onChange={(event) => setEditDiscordId(event.target.value)}
            placeholder="Discord ID 或陪玩ID"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
          />
          <button
            type="submit"
            className="w-full rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
          >
            跳转编辑
          </button>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
