'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Boss = {
  dlmId: string;
  wechatContact: string;
  displayName: string | null;
  totalBalance: string;
  loyaltyPoints: string;
  createdAt: string;
};

type Gift = { name: string; price: string };
type Peiwan = { id: number; label: string; prices: Partial<Record<string, string>> };
type Operation = { id: string; dlmId: string; type: string; status: string; operatorDiscordId: string; createdAt: string; details: string };

const newRequestId = () => globalThis.crypto.randomUUID();

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '操作失败，请稍后重试。');
  return data;
}

export function WechatBossManager({ bosses, gifts, peiwans, operations }: { bosses: Boss[]; gifts: Gift[]; peiwans: Peiwan[]; operations: Operation[] }) {
  const router = useRouter();
  const [selectedDlmId, setSelectedDlmId] = useState(bosses[0]?.dlmId ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [giftName, setGiftName] = useState(gifts[0]?.name ?? '');
  const [peiwanId, setPeiwanId] = useState(String(peiwans[0]?.id ?? ''));
  const [quotationCode, setQuotationCode] = useState('Q1');

  const selectedPeiwan = useMemo(() => peiwans.find((item) => String(item.id) === peiwanId) ?? null, [peiwans, peiwanId]);
  const usableQuotes = selectedPeiwan
    ? Object.entries(selectedPeiwan.prices).filter(([, value]) => Number(value) > 0)
    : [];
  const usableQuoteKey = usableQuotes.map(([code]) => code).join(',');

  useEffect(() => {
    if (usableQuotes.some(([code]) => code === quotationCode)) return;
    setQuotationCode(usableQuotes[0]?.[0] ?? '');
  }, [quotationCode, usableQuoteKey]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await action() as { notificationWarning?: unknown } | undefined;
      const notificationWarning = typeof outcome?.notificationWarning === 'string' ? outcome.notificationWarning : null;
      setMessage(notificationWarning ? `${success} ${notificationWarning}` : success);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  const createBoss = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses', {
        requestId: newRequestId(),
        wechatContact: form.get('wechatContact'),
        displayName: form.get('displayName'),
      }),
      '老板账户已创建；请把生成的 DLM ID 交给老板登录只读个人中心。',
    );
  };

  const recharge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses/recharge', {
        requestId: newRequestId(),
        dlmId: selectedDlmId,
        amount: form.get('amount'),
        receiptReference: form.get('receiptReference'),
        note: form.get('note'),
      }),
      '微信人工充值已入账，并已写入账户流水和管理员审计。',
    );
  };

  const delegatedGift = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses/delegated-gift', {
        requestId: newRequestId(),
        dlmId: selectedDlmId,
        peiwanId: form.get('peiwanId'),
        giftName,
        quantity: form.get('quantity'),
      }),
      '代打赏已完成，余额、积分、礼物账本和操作审计均已更新。',
    );
  };

  const delegatedOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses/delegated-order', {
        requestId: newRequestId(),
        dlmId: selectedDlmId,
        peiwanId,
        quotationCode,
        orderContent: form.get('orderContent'),
      }),
      '代点单已创建，并已向陪玩发送真实接单邀请。',
    );
  };

  return (
    <div className="space-y-6">
      {message ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div><h2 className="text-xl font-semibold">新建微信老板账户</h2><p className="mt-1 text-sm text-white/60">创建后系统分配唯一 DLM ID；不设置密码，DLM ID 仅用于只读个人中心。</p></div>
        <form onSubmit={createBoss} className="grid gap-3 md:grid-cols-3">
          <input name="wechatContact" required placeholder="老板微信号" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <input name="displayName" required placeholder="老板备注名" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy} className="rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">创建并分配 DLM ID</button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div><h2 className="text-xl font-semibold">选择老板</h2><p className="mt-1 text-sm text-white/60">以下仅列出客服创建的微信老板账户。</p></div>
        <select value={selectedDlmId} onChange={(event) => setSelectedDlmId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
          <option value="">请选择老板账户</option>
          {bosses.map((boss) => <option key={boss.dlmId} value={boss.dlmId}>{boss.displayName || boss.wechatContact} · {boss.dlmId} · 余额 ¥{boss.totalBalance}</option>)}
        </select>
        {selectedDlmId ? <p className="text-xs text-white/50">请在核对老板身份和微信收款后再操作。所有操作均记录当前管理员 Discord ID。</p> : null}
      </section>

      {selectedDlmId ? <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={recharge} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div><h2 className="text-xl font-semibold">微信人工充值</h2><p className="mt-1 text-sm text-white/60">金额和唯一微信收款号为必填项，用于防止重复入账；备注可选。</p></div>
          <input name="amount" required inputMode="decimal" placeholder="金额，例如 100.00" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <input name="receiptReference" required placeholder="微信收款号" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <textarea name="note" placeholder="备注（可选）" className="min-h-20 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">确认入账</button>
        </form>

        <form onSubmit={delegatedGift} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div><h2 className="text-xl font-semibold">代打赏</h2><p className="mt-1 text-sm text-white/60">直接走 Bot 的真实礼物、余额与积分账本。</p></div>
          <input name="peiwanId" required type="number" min="1" step="1" inputMode="numeric" placeholder="陪玩数字 ID" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <select value={giftName} onChange={(event) => setGiftName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
            {gifts.map((gift) => <option key={gift.name} value={gift.name}>{gift.name} · ¥{gift.price}</option>)}
          </select>
          <input name="quantity" required type="number" min="1" step="1" defaultValue="1" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy || !gifts.length} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">确认代打赏</button>
        </form>

        <form onSubmit={delegatedOrder} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3 lg:col-span-2">
          <div><h2 className="text-xl font-semibold">代点单</h2><p className="mt-1 text-sm text-white/60">创建真实待接订单，并向选定陪玩发送接单邀请；订单实际结算仍按老板 DLM 钱包执行。</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={peiwanId} onChange={(event) => setPeiwanId(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
              {peiwans.map((peiwan) => <option key={peiwan.id} value={peiwan.id}>{peiwan.label}</option>)}
            </select>
            <select value={quotationCode} onChange={(event) => setQuotationCode(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
              {usableQuotes.map(([code, price]) => <option key={code} value={code}>{code} · ¥{price}/小时</option>)}
            </select>
          </div>
          <textarea name="orderContent" placeholder="订单内容 / 游戏需求（可选）" className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy || !peiwans.length || !usableQuotes.length} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">创建代点订单</button>
        </form>
      </div> : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">微信老板账户</h2>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/50"><tr><th className="px-3 py-3">老板</th><th className="px-3 py-3">DLM ID</th><th className="px-3 py-3">余额</th><th className="px-3 py-3">积分</th></tr></thead><tbody>{bosses.map((boss) => <tr key={boss.dlmId} className="border-b border-white/5"><td className="px-3 py-3">{boss.displayName || boss.wechatContact}</td><td className="px-3 py-3 font-mono text-xs text-[#c4b5fd]">{boss.dlmId}</td><td className="px-3 py-3">¥{boss.totalBalance}</td><td className="px-3 py-3">{boss.loyaltyPoints}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">最近管理员操作审计</h2>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/50"><tr><th className="px-3 py-3">时间</th><th className="px-3 py-3">DLM ID</th><th className="px-3 py-3">操作</th><th className="px-3 py-3">管理员</th><th className="px-3 py-3">状态 / 明细</th></tr></thead><tbody>{operations.map((operation) => <tr key={operation.id} className="border-b border-white/5"><td className="whitespace-nowrap px-3 py-3 text-white/55">{new Date(operation.createdAt).toLocaleString('zh-CN', { hour12: false })}</td><td className="px-3 py-3 font-mono text-xs text-[#c4b5fd]">{operation.dlmId}</td><td className="px-3 py-3">{operation.type}</td><td className="px-3 py-3 font-mono text-xs">{operation.operatorDiscordId}</td><td className="px-3 py-3"><span className="text-white/80">{operation.status}</span><p className="mt-1 max-w-md break-all font-mono text-xs text-white/45">{operation.details}</p></td></tr>)}{!operations.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-white/45">暂无管理员操作记录</td></tr> : null}</tbody></table></div>
      </section>
    </div>
  );
}
