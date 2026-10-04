'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type RecordRow = { id: string; amount: string; note: string; operatorId: string; at: string; sourceMonthKey?: string | null };

export default function MonthlyDividendManager({
  monthKey, confirmed, isCurrentMonth, decisions, payments, payable,
}: {
  monthKey: string;
  confirmed: boolean;
  isCurrentMonth: boolean;
  decisions: RecordRow[];
  payments: RecordRow[];
  payable: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<'decision' | 'payment'>('decision');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sourceMonthKey, setSourceMonthKey] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const money = (raw: string) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(raw));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/revenue/files/dividends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind, monthKey, amount, note,
          sourceMonthKey: kind === 'decision' ? sourceMonthKey : undefined,
          paidAt: kind === 'payment' && paidAt ? new Date(paidAt).toISOString() : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');
      setAmount('');
      setNote('');
      setSourceMonthKey('');
      setPaidAt('');
      setMessage(result.reportSynced ? '已保存并更新报表' : '已保存；Excel 刷新失败，请稍后重试');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally { setPending(false); }
  };
  return (
    <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div>
        <h3 className="text-lg font-semibold">利润分配与股东分红</h3>
        <p className="mt-1 text-sm text-white/60">当月盈亏先进入经营资本。决定分红后转为应付分红；实际付款再冲减银行余额和应付分红，不计入利润表支出。记录只追加，不覆盖原记录。</p>
        <p className="mt-2 text-sm">本月末应付分红：<span className="font-mono">{money(payable)}</span></p>
      </div>
      {!confirmed ? (
        <form onSubmit={save} className="grid gap-3 rounded-2xl border border-white/10 p-4 md:grid-cols-2">
          <label className="text-sm">记录类型
            <select value={kind} onChange={(event) => setKind(event.target.value as 'decision' | 'payment')} className="mt-1 w-full rounded-lg bg-zinc-900 p-2">
              <option value="decision">决定分红／冲回决定</option>
              {isCurrentMonth ? <option value="payment">实际支付分红</option> : null}
            </select>
          </label>
          <label className="text-sm">金额（元）
            <input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={kind === 'decision' ? '如 8000；冲回填 -8000' : '实际付款金额'} className="mt-1 w-full rounded-lg bg-zinc-900 p-2" />
          </label>
          <label className="text-sm">备注
            <input required maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-900 p-2" />
          </label>
          {kind === 'decision' ? <label className="text-sm">原属月份（仅用于前期调整，可留空）
            <input type="month" value={sourceMonthKey} onChange={(event) => setSourceMonthKey(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-900 p-2" />
          </label> : <label className="text-sm">实际付款时间（留空为现在，按浏览器本地时间输入）
            <input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-900 p-2" />
          </label>}
          <div className="md:col-span-2"><button disabled={pending} className="rounded-full bg-white px-5 py-2 text-sm text-black disabled:opacity-50">{pending ? '保存中…' : '保存记录'}</button>{message ? <span className="ml-3 text-sm text-amber-100">{message}</span> : null}</div>
        </form>
      ) : <p className="text-sm text-amber-100">本月已确认，不能改写旧报表；分红决定调整请在当前未确认月份新增记录并注明原属月份。</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div><h4 className="mb-2 text-sm font-semibold">本月决定／冲回</h4>{decisions.length ? decisions.map((row) => <p key={row.id} className="border-t border-white/10 py-2 text-sm">{money(row.amount)} · {row.note}{row.sourceMonthKey ? `（原属 ${row.sourceMonthKey}）` : ''}<span className="block text-xs text-white/50">{row.operatorId} · {new Date(row.at).toLocaleString('zh-CN', { timeZone: 'Europe/Rome' })}</span></p>) : <p className="text-sm text-white/50">暂无记录</p>}</div>
        <div><h4 className="mb-2 text-sm font-semibold">本月实际付款</h4>{payments.length ? payments.map((row) => <p key={row.id} className="border-t border-white/10 py-2 text-sm">{money(row.amount)} · {row.note}<span className="block text-xs text-white/50">{row.operatorId} · {new Date(row.at).toLocaleString('zh-CN', { timeZone: 'Europe/Rome' })}</span></p>) : <p className="text-sm text-white/50">暂无记录</p>}</div>
      </div>
    </section>
  );
}
