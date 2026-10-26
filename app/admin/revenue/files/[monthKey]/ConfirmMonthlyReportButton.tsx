'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ConfirmMonthlyReportButton({ monthKey }: { monthKey: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const confirm = async () => {
    if (!window.confirm(`确认 ${monthKey} 月结？确认后本月数字及 Excel 将固定，后续差额进入当前月份。`)) return;
    setSaving(true);
    setMessage('正在核对并固定月末余额…');
    try {
      const formData = new FormData();
      formData.set('monthKey', monthKey);
      const response = await fetch('/api/admin/revenue/files/confirm', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || '确认月结失败');
      }
      setMessage('月结已确认。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '确认月结失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={confirm}
        disabled={saving}
        className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-5 py-2 text-sm text-emerald-100 hover:bg-emerald-300/20 disabled:opacity-60"
      >
        {saving ? '确认中…' : '确认本月数字'}
      </button>
      {message ? <span className="text-xs text-white/60">{message}</span> : null}
    </div>
  );
}
