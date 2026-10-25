'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TargetConfirmationCard, useTargetConfirmation } from '@/components/profile/TargetConfirmation';
import { GiftExecutionRecovery, useGiftExecutionRecovery } from '@/components/profile/GiftExecutionRecovery';
import { giftIntentForConfirmation, type GiftActor } from '@/lib/gift-execution-client';
import type { TargetConfirmation } from '@/lib/target-confirmation-client';

const GIFT_REASONS = ['充值返现', '公会成本', 'VIP福利', '老板赔偿', '其他'] as const;

type Boss = {
  dlmId: string;
  wechatContact: string;
  displayName: string | null;
  totalBalance: string;
  loyaltyPoints: string;
  createdAt: string;
};

type Gift = { name: string; price: string };
type Peiwan = { id: number; discordId: string; label: string; prices: Partial<Record<string, string>> };
type Operation = { id: string; dlmId: string; type: string; status: string; operatorDiscordId: string; createdAt: string; details: string; result: string };
type ManualRecharge = { operationId: string; sourceDlmId: string; bossLabel: string; rechargeId: string; amount: string; createdAt: string };
type MessagePlacement = 'createBoss' | 'recharge' | 'rechargeCorrection' | 'giftBalance' | 'delegatedGift' | 'delegatedOrder';

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

export function WechatBossManager({ bosses, gifts, peiwans, manualRecharges = [], operations, actor = { dlmId: '', discordId: null } }: { bosses: Boss[]; gifts: Gift[]; peiwans: Peiwan[]; manualRecharges?: ManualRecharge[]; operations: Operation[]; actor?: GiftActor }) {
  const router = useRouter();
  const giftOptions = [
    ...gifts.filter((gift) => gift.name === '冰淇淋'),
    ...gifts.filter((gift) => gift.name !== '冰淇淋'),
  ];
  const [selectedDlmId, setSelectedDlmId] = useState(bosses[0]?.dlmId ?? '');
  const [correctionSourceOperationId, setCorrectionSourceOperationId] = useState(manualRecharges[0]?.operationId ?? '');
  const [correctionTargetDlmId, setCorrectionTargetDlmId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messagePlacement, setMessagePlacement] = useState<MessagePlacement>('createBoss');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [giftName, setGiftName] = useState(giftOptions[0]?.name ?? '');
  const [giftTarget, setGiftTarget] = useState('');
  const [giftQuantity, setGiftQuantity] = useState('1');
  const giftScope = { purpose: 'delegated-gift' as const, target: giftTarget, payerDlmId: selectedDlmId, giftName, quantity: Number(giftQuantity) };
  const giftRecovery = useGiftExecutionRecovery(actor, 'DELEGATED_GIFT');
  const giftConfirmation = useTargetConfirmation(giftScope, { autoLookup: !giftRecovery.blocked && !busy });
  const submittedGiftConfirmation = useRef<TargetConfirmation | null>(null);
  const handledGiftCompletion = useRef<string | null>(null);
  useEffect(() => {
    let previousDraftVersion = giftRecovery.controller.getSnapshot().draftVersion;
    return giftRecovery.controller.subscribe(() => {
      const snapshot = giftRecovery.controller.getSnapshot();
      if (snapshot.draftVersion !== previousDraftVersion) {
        previousDraftVersion = snapshot.draftVersion;
        giftConfirmation.controller.invalidate();
        setGiftTarget(''); setGiftQuantity('1');
      }
      const result = snapshot.completed;
      if (!result || handledGiftCompletion.current === result.record.requestId) return;
      handledGiftCompletion.current = result.record.requestId;
      if (result.prepareNext) {
        giftConfirmation.controller.invalidate();
        setGiftTarget(''); setGiftQuantity('1'); setError(null);
      }
      router.refresh();
    });
  }, [giftRecovery.controller, giftConfirmation.controller, router]);
  const [giftReason, setGiftReason] = useState<(typeof GIFT_REASONS)[number]>('充值返现');
  const [peiwanReference, setPeiwanReference] = useState('');
  const [quotationCode, setQuotationCode] = useState('Q1');
  const correctionSource = useMemo(
    () => manualRecharges.find((recharge) => recharge.operationId === correctionSourceOperationId) ?? null,
    [correctionSourceOperationId, manualRecharges],
  );

  useEffect(() => {
    if (!manualRecharges.some((recharge) => recharge.operationId === correctionSourceOperationId)) {
      setCorrectionSourceOperationId(manualRecharges[0]?.operationId ?? '');
    }
  }, [correctionSourceOperationId, manualRecharges]);

  useEffect(() => {
    if (!correctionSource) return;
    if (correctionTargetDlmId && correctionTargetDlmId !== correctionSource.sourceDlmId) return;
    setCorrectionTargetDlmId(bosses.find((boss) => boss.dlmId !== correctionSource.sourceDlmId)?.dlmId ?? '');
  }, [bosses, correctionSource, correctionTargetDlmId]);

  const selectedPeiwan = useMemo(() => {
    const reference = peiwanReference.trim();
    if (!reference) return null;
    return peiwans.find((item) => String(item.id) === reference || item.discordId === reference) ?? null;
  }, [peiwans, peiwanReference]);
  const usableQuotes = selectedPeiwan
    ? Object.entries(selectedPeiwan.prices).filter(([, value]) => Number(value) > 0)
    : [];
  const usableQuoteKey = usableQuotes.map(([code]) => code).join(',');

  useEffect(() => {
    if (usableQuotes.some(([code]) => code === quotationCode)) return;
    setQuotationCode(usableQuotes[0]?.[0] ?? '');
  }, [quotationCode, usableQuoteKey]);

  const run = async (
    action: () => Promise<unknown>,
    success: string,
    placement: MessagePlacement,
    balanceGiftReason?: string,
  ) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setMessagePlacement(placement);
    try {
      const outcome = await action() as { notificationWarning?: unknown; replayed?: unknown; result?: { amount?: unknown; balanceAfter?: unknown; currentBalance?: unknown; rechargeId?: unknown; sourceBalanceAfter?: unknown; targetBalanceAfter?: unknown } } | undefined;
      const notificationWarning = typeof outcome?.notificationWarning === 'string' ? outcome.notificationWarning : null;
      const replayed = outcome?.replayed === true;
      const amount = typeof outcome?.result?.amount === 'string' ? outcome.result.amount : null;
      const balanceAfter = typeof outcome?.result?.balanceAfter === 'string' ? outcome.result.balanceAfter : null;
      const currentBalance = typeof outcome?.result?.currentBalance === 'string' ? outcome.result.currentBalance : balanceAfter;
      const rechargeId = typeof outcome?.result?.rechargeId === 'string' ? outcome.result.rechargeId : null;
      const sourceBalanceAfter = typeof outcome?.result?.sourceBalanceAfter === 'string' ? outcome.result.sourceBalanceAfter : null;
      const targetBalanceAfter = typeof outcome?.result?.targetBalanceAfter === 'string' ? outcome.result.targetBalanceAfter : null;
      const successMessage = replayed
        ? `该次提交此前已完成，本次未重复增加余额${currentBalance ? `。当前余额：${currentBalance} 点点券` : '。'}`
        : placement === 'rechargeCorrection'
          ? `充值更正已完成：已转移 ¥${amount ?? '—'}。原老板余额：${sourceBalanceAfter ?? '—'} 点点券；正确老板余额：${targetBalanceAfter ?? '—'} 点点券。`
        : placement === 'giftBalance'
          ? `余额赠送已发放：${amount ?? '—'}（${balanceGiftReason ?? '余额赠送'}）。${balanceAfter ? ` 当前余额：${balanceAfter} 点点券。` : ''}`
          : `${success}${balanceAfter ? ` 当前余额：${balanceAfter} 点点券。` : ''}${rechargeId ? ` 充值记录编号：${rechargeId}。` : ''}`;
      setMessage(notificationWarning ? `${successMessage} ${notificationWarning}` : successMessage);
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
      'createBoss',
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
        receiptAccount: form.get('receiptAccount'),
        note: form.get('note'),
      }),
      '微信人工充值已入账，并已写入账户流水和管理员审计。',
      'recharge',
    );
  };

  const correctRecharge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses/recharge-correction', {
        requestId: newRequestId(),
        sourceOperationId: correctionSourceOperationId,
        targetDlmId: correctionTargetDlmId,
        reason: form.get('reason'),
      }),
      '充值更正已完成。',
      'rechargeCorrection',
    );
  };

  const giftBalance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses/cashback', {
        requestId: newRequestId(),
        dlmId: selectedDlmId,
        amount: form.get('amount'),
        reason: giftReason,
      }),
      '余额赠送已发放：余额、个人流水、Expense 支出和管理员审计均已写入。',
      'giftBalance',
      giftReason,
    );
  };

  const delegatedGift = async () => {
    if (!giftConfirmation.ready || !giftConfirmation.confirmation || busy || giftRecovery.blocked || submittedGiftConfirmation.current === giftConfirmation.confirmation) return;
    submittedGiftConfirmation.current = giftConfirmation.confirmation;
    setBusy(true); setError(null); setMessage(null); setMessagePlacement('delegatedGift');
    try {
      await giftRecovery.controller.submit({ scope: giftScope, confirmation: giftConfirmation.confirmation,
        intent: giftIntentForConfirmation(actor, giftScope, giftConfirmation.confirmation, giftName), path: '/api/admin/wechat-bosses/delegated-gift',
        body: { dlmId: selectedDlmId, peiwanId: giftTarget.trim(), giftName, quantity: Number(giftQuantity) } });
    } catch { setError('无法保存已确认的代赠信息，本次未提交。请重新确认对象。'); }
    finally { setBusy(false); }
  };

  const delegatedOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => postJson('/api/admin/wechat-bosses/delegated-order', {
        requestId: newRequestId(),
        dlmId: selectedDlmId,
        peiwanId: peiwanReference,
        quotationCode,
        orderContent: form.get('orderContent'),
      }),
      '代点单已创建，并已向陪玩发送真实接单邀请。',
      'delegatedOrder',
    );
  };

  return (
    <div className="space-y-6">
      <GiftExecutionRecovery actor={actor} kind="DELEGATED_GIFT" dark onNew={() => { giftConfirmation.controller.invalidate(); setGiftTarget(''); }} />
      {error ? <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div><h2 className="text-xl font-semibold">新建微信老板账户</h2><p className="mt-1 text-sm text-white/60">创建后系统分配唯一 DLM ID；不设置密码，DLM ID 仅用于只读个人中心。</p></div>
        <form onSubmit={createBoss} className="grid gap-3 md:grid-cols-3">
          <input name="wechatContact" required placeholder="老板微信号" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <input name="displayName" required placeholder="老板备注名" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy} className="rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">创建并分配 DLM ID</button>
          {message && messagePlacement === 'createBoss' ? <p className="md:col-span-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </form>
      </section>

      {manualRecharges.length > 0 && bosses.length > 1 ? (
        <section className="rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">充值更正</h2>
            <p className="mt-1 text-sm text-white/60">仅用于微信人工充值误充到错误老板的情况。系统会保留原充值记录，并新增一笔扣回与一笔转入流水；原老板余额不足时会拒绝操作。</p>
          </div>
          <form onSubmit={correctRecharge} className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              原充值记录
              <select value={correctionSourceOperationId} onChange={(event) => setCorrectionSourceOperationId(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-amber-300">
                {manualRecharges.map((recharge) => (
                  <option key={recharge.operationId} value={recharge.operationId}>
                    {recharge.bossLabel} · ¥{recharge.amount} · {recharge.rechargeId} · {new Date(recharge.createdAt).toLocaleString('zh-CN', { hour12: false })}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              正确老板
              <select value={correctionTargetDlmId} onChange={(event) => setCorrectionTargetDlmId(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-amber-300">
                <option value="">请选择正确老板</option>
                {bosses.filter((boss) => boss.dlmId !== correctionSource?.sourceDlmId).map((boss) => (
                  <option key={boss.dlmId} value={boss.dlmId}>{boss.displayName || boss.wechatContact} · {boss.dlmId} · 当前余额 ¥{boss.totalBalance}</option>
                ))}
              </select>
            </label>
            <textarea name="reason" required maxLength={500} placeholder="更正原因，例如：误选了老板 A，实际付款人为老板 B" className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-amber-300 lg:col-span-2" />
            <button disabled={busy || !correctionSource || !correctionTargetDlmId} className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-medium text-black disabled:opacity-60 lg:col-span-2">确认更正并转移余额</button>
            {message && messagePlacement === 'rechargeCorrection' ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100 lg:col-span-2">{message}</p> : null}
          </form>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="space-y-4 border-b border-white/10 pb-6">
          <div><h2 className="text-xl font-semibold">选择老板</h2><p className="mt-1 text-sm text-white/60">以下仅列出客服创建的微信老板账户。</p></div>
          <select value={selectedDlmId} disabled={giftRecovery.state.busy} onChange={(event) => { giftConfirmation.controller.invalidate(); setSelectedDlmId(event.target.value); }} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
            <option value="">请选择老板账户</option>
            {bosses.map((boss) => <option key={boss.dlmId} value={boss.dlmId}>{boss.displayName || boss.wechatContact} · {boss.dlmId} · 余额 ¥{boss.totalBalance}</option>)}
          </select>
          {selectedDlmId ? <p className="text-xs text-white/50">请在核对老板身份和微信收款后再操作。所有操作均记录当前管理员 Discord ID。</p> : null}
        </div>

        {selectedDlmId ? <div className="grid gap-x-8 gap-y-8 pt-6 lg:grid-cols-2">
        <form onSubmit={recharge} className="space-y-3 lg:border-r lg:border-white/10 lg:pr-8">
          <div><h2 className="text-xl font-semibold">微信人工充值</h2><p className="mt-1 text-sm text-white/60">金额和微信收款账号为必填项；同一收款账号可以有多笔充值。系统会生成唯一充值记录编号，供核账和返现使用。</p></div>
          <input name="amount" required inputMode="decimal" placeholder="金额，例如 100.00" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <input name="receiptAccount" required placeholder="微信收款账号，例如 iria支付宝" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <textarea name="note" placeholder="备注（可选）" className="min-h-20 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">确认入账</button>
          {message && messagePlacement === 'recharge' ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </form>

        <form onSubmit={giftBalance} className="space-y-3">
          <div><h2 className="text-xl font-semibold">余额赠送</h2><p className="mt-1 text-sm text-white/60">与 /gift 一致：增加余额，并按所选原因记录 Expense 和个人流水。</p></div>
          <input name="amount" required inputMode="decimal" placeholder="赠送金额，例如 10.00" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <select value={giftReason} onChange={(event) => setGiftReason(event.target.value as (typeof GIFT_REASONS)[number])} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
            {GIFT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
          <button disabled={busy} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">确认赠送余额</button>
          {message && messagePlacement === 'giftBalance' ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </form>

        <form onSubmit={(event) => { event.preventDefault(); void delegatedGift(); }} className="space-y-3 border-t border-white/10 pt-8 lg:border-r lg:pr-8">
          <div><h2 className="text-xl font-semibold">代打赏</h2><p className="mt-1 text-sm text-white/60">输入后自动显示付款老板和接收陪玩，核对礼物及数量后确认赠送。</p></div>
          <input aria-label="代打赏陪玩" value={giftTarget} disabled={giftRecovery.blocked} onChange={(event) => { giftConfirmation.controller.invalidate(); setGiftTarget(event.target.value); }} required inputMode="numeric" placeholder="陪玩 Discord ID 或数字 ID" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <select aria-label="代打赏礼物" value={giftName} disabled={giftRecovery.blocked} onChange={(event) => { giftConfirmation.controller.invalidate(); setGiftName(event.target.value); }} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
            {giftOptions.map((gift) => <option key={gift.name} value={gift.name}>{gift.name} · ¥{gift.price}</option>)}
          </select>
          <label className="block space-y-1 text-sm text-white/70">礼物数量
            <input aria-label="代打赏数量" value={giftQuantity} disabled={giftRecovery.blocked} onChange={(event) => { giftConfirmation.controller.invalidate(); setGiftQuantity(event.target.value); }} required type="number" min="0" step="any" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          </label>
          {giftConfirmation.lookingUp ? <p role="status" className="text-sm text-white/60">正在查找付款老板和接收陪玩…</p> : null}
          <TargetConfirmationCard confirmation={giftConfirmation.confirmation} dark />
          {giftConfirmation.ready ? <p className="text-sm text-white/70">礼物：{giftName} × {giftQuantity}</p> : null}
          <button type="submit" disabled={busy || giftRecovery.blocked || !giftConfirmation.ready} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">{giftRecovery.state.busy ? '提交中…' : '确认代打赏'}</button>
          {giftConfirmation.state.message ? <p role="status" className="break-words rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{giftConfirmation.state.message}</p> : null}
          {giftConfirmation.state.phase === 'error' && !giftRecovery.blocked && !busy ? <button type="button" onClick={() => void giftConfirmation.lookup()} className="text-sm text-violet-200 underline">重新查找对象</button> : null}
          {message && messagePlacement === 'delegatedGift' ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </form>

        <form onSubmit={delegatedOrder} className="space-y-3 border-t border-white/10 pt-8 lg:col-start-2">
          <div><h2 className="text-xl font-semibold">代点单</h2><p className="mt-1 text-sm text-white/60">创建真实待接订单，并向选定陪玩发送接单邀请；订单实际结算仍按老板 DLM 钱包执行。</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={peiwanReference}
              onChange={(event) => setPeiwanReference(event.target.value)}
              required
              inputMode="numeric"
              placeholder="陪玩 Discord ID 或数字 ID"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]"
            />
            <select value={quotationCode} onChange={(event) => setQuotationCode(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]">
              {usableQuotes.map(([code, price]) => <option key={code} value={code}>{code} · ¥{price}/小时</option>)}
            </select>
          </div>
          {peiwanReference.trim() && !selectedPeiwan ? <p className="text-xs text-amber-200">未找到该陪玩，请检查 Discord ID 或数字 ID。</p> : null}
          <textarea name="orderContent" placeholder="订单内容 / 游戏需求（可选）" className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#9b7ee8]" />
          <button disabled={busy || !selectedPeiwan || !usableQuotes.length} className="w-full rounded-xl bg-[#7356c6] px-4 py-3 text-sm disabled:opacity-60">创建代点订单</button>
          {message && messagePlacement === 'delegatedOrder' ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
        </form>
      </div> : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">微信老板账户</h2>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/50"><tr><th className="px-3 py-3">老板</th><th className="px-3 py-3">DLM ID</th><th className="px-3 py-3">余额</th><th className="px-3 py-3">积分</th></tr></thead><tbody>{bosses.map((boss) => <tr key={boss.dlmId} className="border-b border-white/5"><td className="px-3 py-3">{boss.displayName || boss.wechatContact}</td><td className="px-3 py-3 font-mono text-xs text-[#c4b5fd]">{boss.dlmId}</td><td className="px-3 py-3">¥{boss.totalBalance}</td><td className="px-3 py-3">{boss.loyaltyPoints}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">最近管理员操作审计</h2>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/50"><tr><th className="px-3 py-3">时间</th><th className="px-3 py-3">DLM ID</th><th className="px-3 py-3">操作</th><th className="px-3 py-3">管理员</th><th className="px-3 py-3">状态 / 明细 / 结果</th></tr></thead><tbody>{operations.map((operation) => <tr key={operation.id} className="border-b border-white/5"><td className="whitespace-nowrap px-3 py-3 text-white/55">{new Date(operation.createdAt).toLocaleString('zh-CN', { hour12: false })}</td><td className="px-3 py-3 font-mono text-xs text-[#c4b5fd]">{operation.dlmId}</td><td className="px-3 py-3">{operation.type}</td><td className="px-3 py-3 font-mono text-xs">{operation.operatorDiscordId}</td><td className="px-3 py-3"><span className="text-white/80">{operation.status}</span><p className="mt-1 max-w-md break-all font-mono text-xs text-white/45">{operation.details}</p><p className="mt-1 max-w-md break-all font-mono text-xs text-[#c4b5fd]/70">{operation.result}</p></td></tr>)}{!operations.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-white/45">暂无管理员操作记录</td></tr> : null}</tbody></table></div>
      </section>
    </div>
  );
}
