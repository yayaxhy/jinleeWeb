'use client';

import { ReferralType } from '@prisma/client';
import { useEffect, useState, type FormEvent } from 'react';

type ReferralPolicyRecord = {
  id: string;
  inviterId: string;
  referralType: ReferralType | null;
  rate: string;
  capAmount: string | null;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
  createdAt: string;
};

type PolicyDraft = {
  referralType: string;
  rate: string;
  capAmount: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  note: string;
};

const EMPTY_FORM: PolicyDraft & { inviterId: string } = {
  inviterId: '',
  referralType: '',
  rate: '0.01',
  capAmount: '1000',
  enabled: true,
  startsAt: '',
  endsAt: '',
  note: '',
};

const toDateTimeLocal = (value?: string | null) => (value ? String(value).slice(0, 16) : '');

const toDraft = (policy: ReferralPolicyRecord): PolicyDraft => ({
  referralType: policy.referralType ?? '',
  rate: policy.rate,
  capAmount: policy.capAmount ?? '',
  enabled: policy.enabled,
  startsAt: toDateTimeLocal(policy.startsAt),
  endsAt: toDateTimeLocal(policy.endsAt),
  note: policy.note ?? '',
});

export function ReferralPolicyManager({ readOnly = false }: { readOnly?: boolean }) {
  const [policies, setPolicies] = useState<ReferralPolicyRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPolicies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/referral-policies');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: 'error', text: typeof data?.error === 'string' ? data.error : '规则加载失败' });
        setPolicies([]);
        return;
      }
      const rows: ReferralPolicyRecord[] = Array.isArray(data?.policies) ? data.policies : [];
      setPolicies(rows);
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])));
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicies();
  }, []);

  const updateDraft = (policyId: string, patch: Partial<PolicyDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [policyId]: {
        ...(prev[policyId] ?? {
          referralType: '',
          rate: '0.01',
          capAmount: '',
          enabled: true,
          startsAt: '',
          endsAt: '',
          note: '',
        }),
        ...patch,
      },
    }));
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) {
      setMessage({ type: 'error', text: '当前账号为只读权限，无法新增规则。' });
      return;
    }
    setIsCreating(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/referral-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviterId: form.inviterId.trim(),
          referralType: form.referralType || null,
          rate: form.rate,
          capAmount: form.capAmount.trim() === '' ? null : form.capAmount.trim(),
          enabled: form.enabled,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          note: form.note.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: 'error', text: typeof data?.error === 'string' ? data.error : '新增规则失败' });
        return;
      }
      setMessage({ type: 'success', text: '返利规则已创建' });
      setForm(EMPTY_FORM);
      await loadPolicies();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async (policy: ReferralPolicyRecord) => {
    if (readOnly) {
      setMessage({ type: 'error', text: '当前账号为只读权限，无法修改规则。' });
      return;
    }
    const draft = drafts[policy.id];
    if (!draft) return;
    setBusyId(policy.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/referral-policies/${encodeURIComponent(policy.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviterId: policy.inviterId,
          referralType: draft.referralType || null,
          rate: draft.rate,
          capAmount: draft.capAmount.trim() === '' ? null : draft.capAmount.trim(),
          enabled: draft.enabled,
          startsAt: draft.startsAt || null,
          endsAt: draft.endsAt || null,
          note: draft.note.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: 'error', text: typeof data?.error === 'string' ? data.error : '保存规则失败' });
        return;
      }
      setMessage({ type: 'success', text: '返利规则已保存' });
      await loadPolicies();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (readOnly) {
      setMessage({ type: 'error', text: '当前账号为只读权限，无法删除规则。' });
      return;
    }
    if (!window.confirm('确认删除这条返利规则吗？')) return;
    setBusyId(policyId);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/referral-policies/${encodeURIComponent(policyId)}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: 'error', text: typeof data?.error === 'string' ? data.error : '删除规则失败' });
        return;
      }
      setMessage({ type: 'success', text: '返利规则已删除' });
      await loadPolicies();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleEnabled = async (policy: ReferralPolicyRecord) => {
    if (readOnly) {
      setMessage({ type: 'error', text: '当前账号为只读权限，无法修改规则。' });
      return;
    }

    const nextEnabled = !(drafts[policy.id]?.enabled ?? policy.enabled);
    setBusyId(policy.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/referral-policies/${encodeURIComponent(policy.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: 'error', text: typeof data?.error === 'string' ? data.error : '更新启用状态失败' });
        return;
      }
      setMessage({ type: 'success', text: nextEnabled ? '规则已启用' : '规则已停用' });
      await loadPolicies();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">ADMIN</p>
        <h2 className="text-2xl font-semibold">邀请返利规则</h2>
        <p className="text-sm text-white/70">仅影响规则创建后新绑定的邀请关系，历史绑定不追溯。</p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-white/70">邀请人 ID</span>
          <input value={form.inviterId} onChange={(e) => setForm((prev) => ({ ...prev, inviterId: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/70">类型</span>
          <select value={form.referralType} onChange={(e) => setForm((prev) => ({ ...prev, referralType: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly}>
            <option value="" className="bg-[#0f0f0f] text-white">全部</option>
            <option value="LAOBAN" className="bg-[#0f0f0f] text-white">LAOBAN</option>
            <option value="PEIWAN" className="bg-[#0f0f0f] text-white">PEIWAN</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/70">返利比例</span>
          <input value={form.rate} onChange={(e) => setForm((prev) => ({ ...prev, rate: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/70">返利上限（留空=无限）</span>
          <input value={form.capAmount} onChange={(e) => setForm((prev) => ({ ...prev, capAmount: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/70">开始时间</span>
          <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/70">结束时间</span>
          <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-white/70">备注</span>
          <input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={readOnly} />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} disabled={readOnly} />
          启用规则
        </label>
        <button type="submit" disabled={isCreating || readOnly} className="rounded-full bg-[#5c43a3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-3">
          {isCreating ? '提交中…' : '新增返利规则'}
        </button>
      </form>

      {message ? <p className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-white/60 uppercase tracking-[0.3em]">
              <th className="px-4 py-3">邀请人</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">比例</th>
              <th className="px-4 py-3">上限</th>
              <th className="px-4 py-3">开始</th>
              <th className="px-4 py-3">结束</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-3 text-white/60" colSpan={9}>加载中…</td></tr>
            ) : policies.length === 0 ? (
              <tr><td className="px-4 py-3 text-white/60" colSpan={9}>暂无返利规则。</td></tr>
            ) : (
              policies.map((policy) => {
                const draft = drafts[policy.id] ?? toDraft(policy);
                return (
                  <tr key={policy.id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono text-white/80">{policy.inviterId}</td>
                    <td className="px-4 py-3">
                      <select value={draft.referralType} onChange={(e) => updateDraft(policy.id, { referralType: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" disabled={busyId === policy.id || readOnly}>
                        <option value="" className="bg-[#0f0f0f] text-white">全部</option>
                        <option value="LAOBAN" className="bg-[#0f0f0f] text-white">LAOBAN</option>
                        <option value="PEIWAN" className="bg-[#0f0f0f] text-white">PEIWAN</option>
                      </select>
                    </td>
                    <td className="px-4 py-3"><input value={draft.rate} onChange={(e) => updateDraft(policy.id, { rate: e.target.value })} className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" disabled={busyId === policy.id || readOnly} /></td>
                    <td className="px-4 py-3"><input value={draft.capAmount} onChange={(e) => updateDraft(policy.id, { capAmount: e.target.value })} className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" disabled={busyId === policy.id || readOnly} /></td>
                    <td className="px-4 py-3"><input type="datetime-local" value={draft.startsAt} onChange={(e) => updateDraft(policy.id, { startsAt: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" disabled={busyId === policy.id || readOnly} /></td>
                    <td className="px-4 py-3"><input type="datetime-local" value={draft.endsAt} onChange={(e) => updateDraft(policy.id, { endsAt: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" disabled={busyId === policy.id || readOnly} /></td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs ${
                          draft.enabled
                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                            : 'border-white/15 bg-white/5 text-white/60'
                        }`}
                      >
                        {draft.enabled ? '已启用' : '未启用'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><input value={draft.note} onChange={(e) => updateDraft(policy.id, { note: e.target.value })} className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" disabled={busyId === policy.id || readOnly} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleEnabled(policy)}
                          disabled={busyId === policy.id || readOnly}
                          className={`rounded-full border px-3 py-2 text-xs disabled:opacity-60 ${
                            draft.enabled
                              ? 'border-amber-400/40 text-amber-200'
                              : 'border-emerald-400/40 text-emerald-300'
                          }`}
                        >
                          {draft.enabled ? '停用' : '启用'}
                        </button>
                        <button type="button" onClick={() => void handleSave(policy)} disabled={busyId === policy.id || readOnly} className="rounded-full border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-60">保存</button>
                        <button type="button" onClick={() => void handleDelete(policy.id)} disabled={busyId === policy.id || readOnly} className="rounded-full border border-rose-400/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-60">删除</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
