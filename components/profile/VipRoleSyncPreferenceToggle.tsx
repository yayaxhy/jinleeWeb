'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  enabled: boolean;
};

const actionBtn =
  'inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] transition disabled:cursor-not-allowed disabled:opacity-60';

export function VipRoleSyncPreferenceToggle({ enabled }: Props) {
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
        throw new Error(typeof data?.error === 'string' ? data.error : '保存失败');
      }
      setMessage(
        nextEnabled
          ? '已开启 VIP 身份组自动同步，后续消费会按累计消费补齐对应身份组'
          : '已关闭 VIP 身份组自动同步，后续消费不会再自动补回或调整 VIP 身份组',
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
          <h3 className="text-lg font-semibold text-[#171717]">VIP 身份组自动同步</h3>
          <p className="text-sm text-gray-600">
            关闭后，机器人不会再根据累计消费自动补回或调整 Discord 的 VIP 身份组；不会影响累计消费、VIP 等级结算和福利发放
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {enabled ? '自动同步中' : '已停止同步'}
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
            >
              开启同步
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void applyPreference(false)}
              className={`${actionBtn} ${
                !enabled
                  ? 'border-[#b07d00] bg-[#fff4d6] text-[#8a6000]'
                  : 'border-black/10 text-gray-600 hover:bg-black/5'
              }`}
            >
              关闭同步
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">关闭自动同步后，如果当前账号已经有 VIP 身份组，请自行在 Discord 内移除。</p>
      {message ? <p className="text-xs text-gray-500">{message}</p> : null}
    </div>
  );
}
