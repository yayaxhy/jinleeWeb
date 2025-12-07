'use client';

import { ReferralType } from '@prisma/client';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type ReferralRecord = {
  inviteeId: string;
  inviterId: string;
  type: ReferralType;
  createdAt: string;
};

type FilterState = {
  inviteeId: string;
  inviterId: string;
  type: string;
};

const REFERRAL_TYPES: ReferralType[] = ['LAOBAN', 'PEIWAN'];

export function ReferralManager() {
  const [createForm, setCreateForm] = useState<{ inviteeId: string; inviterId: string; type: ReferralType }>({
    inviteeId: '',
    inviterId: '',
    type: 'LAOBAN',
  });
  const [filters, setFilters] = useState<FilterState>({ inviteeId: '', inviterId: '', type: '' });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ inviteeId: '', inviterId: '', type: '' });
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [draftTypes, setDraftTypes] = useState<Record<string, ReferralType>>({});
  const [total, setTotal] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const formattedFilters = useMemo(
    () => ({
      inviteeId: filters.inviteeId.trim(),
      inviterId: filters.inviterId.trim(),
      type: filters.type.trim().toUpperCase(),
    }),
    [filters],
  );

  const fetchReferrals = useCallback(
    async (criteria: FilterState) => {
      setIsLoading(true);
      setListError(null);
      const query = new URLSearchParams();
      if (criteria.inviteeId) query.set('inviteeId', criteria.inviteeId);
      if (criteria.inviterId) query.set('inviterId', criteria.inviterId);
      if (criteria.type) query.set('type', criteria.type.toUpperCase());

      try {
        const response = await fetch(`/api/admin/referrals${query.toString() ? `?${query.toString()}` : ''}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = typeof data?.error === 'string' ? data.error : '查询失败，请稍后重试';
          setReferrals([]);
          setTotal(0);
          setListError(message);
          return;
        }
        const records: ReferralRecord[] = Array.isArray(data?.referrals) ? data.referrals : [];
        setReferrals(records);
        setTotal(typeof data?.total === 'number' ? data.total : records.length);
        setDraftTypes(Object.fromEntries(records.map((item) => [item.inviteeId, item.type])));
      } catch (error) {
        setListError((error as Error).message);
        setReferrals([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchReferrals(appliedFilters);
  }, [fetchReferrals, appliedFilters]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters(formattedFilters);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGlobalMessage(null);
    const inviteeId = createForm.inviteeId.trim();
    const inviterId = createForm.inviterId.trim();
    const type = createForm.type;

    if (!inviteeId || !inviterId) {
      setGlobalMessage({ type: 'error', text: 'inviteeId、inviterId 均为必填' });
      return;
    }
    if (inviteeId === inviterId) {
      setGlobalMessage({ type: 'error', text: '禁止自邀' });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteeId, inviterId, type }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : '保存失败，请稍后重试';
        setGlobalMessage({ type: 'error', text: message });
      } else {
        setGlobalMessage({ type: 'success', text: '邀请关系已保存' });
        setCreateForm((prev) => ({ ...prev, inviteeId: '', inviterId: '' }));
        await fetchReferrals(appliedFilters);
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateType = async (inviteeId: string) => {
    const nextType = draftTypes[inviteeId];
    if (!nextType) return;
    setRowBusyId(inviteeId);
    setGlobalMessage(null);
    try {
      const response = await fetch(`/api/admin/referrals/${encodeURIComponent(inviteeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: nextType }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : '更新失败，请稍后重试';
        setGlobalMessage({ type: 'error', text: message });
      } else {
        setGlobalMessage({ type: 'success', text: '类型已更新' });
        await fetchReferrals(appliedFilters);
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setRowBusyId(null);
    }
  };

  const handleDelete = async (inviteeId: string) => {
    const confirmed = window.confirm(`确认删除 ${inviteeId} 的邀请记录吗？`);
    if (!confirmed) return;
    setRowBusyId(inviteeId);
    setGlobalMessage(null);
    try {
      const response = await fetch(`/api/admin/referrals/${encodeURIComponent(inviteeId)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : '删除失败，请稍后重试';
        setGlobalMessage({ type: 'error', text: message });
      } else {
        setGlobalMessage({ type: 'success', text: '记录已删除' });
        await fetchReferrals(appliedFilters);
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6" id="referral-manager">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">ADMIN</p>
          <h2 className="text-2xl font-semibold">邀请人管理</h2>
          <p className="text-sm text-white/70">插入 / 查询 / 删除 邀请人 记录</p>
        </div>
        
      </div>

     <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={handleCreate} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">新增邀请关系</h3>
            {isCreating ? <span className="text-xs text-white/60">提交中…</span> : null}
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">被邀请人 ID（inviteeId）</span>
            <input
              type="text"
              value={createForm.inviteeId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, inviteeId: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="必填且唯一"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">邀请人 ID（inviterId）</span>
            <input
              type="text"
              value={createForm.inviterId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, inviterId: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="必填"
            />
          </label>
          <label className=" text-sm">
            <span className="text-white/70">类型（type）</span>
            <select
              value={createForm.type}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, type: event.target.value as ReferralType }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            >
              {REFERRAL_TYPES.map((type) => (
                <option key={type} value={type} className="bg-[#0f0f0f] text-white">
                  {type}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isCreating}
            className="mt-2 w-full rounded-full bg-[#5c43a3] px-4 py-2 text-sm font-semibold tracking-[0.2em] text-white hover:bg-[#4a3388] disabled:opacity-60 md:mt-4"
          >
            保存
          </button>
        </form>

        <form onSubmit={handleSearch} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-lg font-semibold text-white">查询 Referral</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-white/70">按邀请人 ID</span>
              <input
                type="text"
                value={filters.inviterId}
                onChange={(event) => setFilters((prev) => ({ ...prev, inviterId: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="inviterId"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/70">按被邀请人 ID</span>
              <input
                type="text"
                value={filters.inviteeId}
                onChange={(event) => setFilters((prev) => ({ ...prev, inviteeId: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="inviteeId"
              />
            </label>
          </div>
          
          <div className="mt-2 flex flex-wrap gap-2 md:mt-4">
            <button
              type="submit"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={() => setFilters({ inviteeId: '', inviterId: '', type: '' })}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              清空
            </button>
          </div>
          <p className="text-xs text-white/60">默认返回最新 100 条，可按 inviterId / inviteeId 过滤。</p>
        </form>
      </div>

      {globalMessage ? (
        <p
          className={`text-sm ${globalMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {globalMessage.text}
        </p>
      ) : null}
      {listError ? <p className="text-sm text-rose-400">{listError}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-white/60 uppercase tracking-[0.3em]">
              <th className="px-4 py-3">InviteeId</th>
              <th className="px-4 py-3">InviterId</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-3 text-white/60" colSpan={5}>
                  加载中…
                </td>
              </tr>
            ) : referrals.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-white/60" colSpan={5}>
                  暂无数据，尝试调整搜索条件。
                </td>
              </tr>
            ) : (
              referrals.map((record) => (
                <tr key={record.inviteeId} className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-white/90">{record.inviteeId}</td>
                  <td className="px-4 py-3 font-mono text-white/80">{record.inviterId}</td>
                  <td className="px-4 py-3">
                    <select
                      value={draftTypes[record.inviteeId] ?? record.type}
                      onChange={(event) =>
                        setDraftTypes((prev) => ({
                          ...prev,
                          [record.inviteeId]: event.target.value as ReferralType,
                        }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                      disabled={rowBusyId === record.inviteeId}
                    >
                      {REFERRAL_TYPES.map((type) => (
                        <option key={type} value={type} className="bg-[#0f0f0f] text-white">
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {new Date(record.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUpdateType(record.inviteeId)}
                        disabled={rowBusyId === record.inviteeId}
                        className="rounded-full border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-60"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(record.inviteeId)}
                        disabled={rowBusyId === record.inviteeId}
                        className="rounded-full border border-rose-400/40 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-60"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
