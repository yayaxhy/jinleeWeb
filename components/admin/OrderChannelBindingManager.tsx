'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type BindingRecord = {
  channelId: string;
  ownerId: string;
  ownerDisplayName?: string | null;
  enabled: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type DraftState = {
  ownerId: string;
  enabled: boolean;
  note: string;
};

type Feedback = { type: 'success' | 'error'; text: string } | null;

const ROME_TIMEZONE = 'Europe/Rome';

export function OrderChannelBindingManager() {
  const [records, setRecords] = useState<BindingRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Feedback>(null);
  const [createForm, setCreateForm] = useState({
    channelId: '',
    ownerId: '',
    enabled: true,
    note: '',
  });

  const syncDrafts = useCallback((rows: BindingRecord[]) => {
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.channelId,
          {
            ownerId: row.ownerId,
            enabled: row.enabled,
            note: row.note ?? '',
          },
        ]),
      ),
    );
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/order-channel-bindings');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '加载失败');
      }
      const rows = Array.isArray(data?.bindings) ? (data.bindings as BindingRecord[]) : [];
      setRecords(rows);
      syncDrafts(rows);
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
      setRecords([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [syncDrafts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/order-channel-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: createForm.channelId.trim(),
          ownerId: createForm.ownerId.trim(),
          enabled: createForm.enabled,
          note: createForm.note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '保存失败');
      }
      setCreateForm({ channelId: '', ownerId: '', enabled: true, note: '' });
      setMessage({ type: 'success', text: '绑定已保存' });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (channelId: string) => {
    const draft = drafts[channelId];
    if (!draft) return;
    setBusyId(channelId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/order-channel-bindings/${encodeURIComponent(channelId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: draft.ownerId.trim(),
          enabled: draft.enabled,
          note: draft.note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '更新失败');
      }
      setMessage({ type: 'success', text: `已更新频道 ${channelId}` });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (channelId: string) => {
    const confirmed = window.confirm(`确认删除频道 ${channelId} 的专属绑定吗？`);
    if (!confirmed) return;
    setBusyId(channelId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/order-channel-bindings/${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '删除失败');
      }
      setMessage({ type: 'success', text: `已删除频道 ${channelId}` });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">ADMIN</p>
        <h2 className="text-2xl font-semibold">老板专属派单区绑定</h2>
        <p className="text-sm text-white/70">配置频道ID与老板Discord ID绑定，机器人会自动生效。</p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-white/70">频道 ID</span>
          <input
            type="text"
            value={createForm.channelId}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, channelId: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            placeholder="例如 1473760658402185300"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/70">老板 Discord ID</span>
          <input
            type="text"
            value={createForm.ownerId}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, ownerId: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            placeholder="例如 1406682067852595291"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-white/70">备注（可选）</span>
          <input
            type="text"
            value={createForm.note}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            placeholder="例如：老板A专属派单区"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={createForm.enabled}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, enabled: event.target.checked }))}
          />
          启用
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4a3388] disabled:opacity-60"
          >
            {creating ? '保存中…' : '新增绑定'}
          </button>
        </div>
      </form>

      {message ? (
        <p className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {message.text}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-white/60 uppercase tracking-[0.3em]">
              <th className="px-4 py-3">频道ID</th>
              <th className="px-4 py-3">老板ID</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3">启用</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-3 text-white/60" colSpan={6}>
                  加载中…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-white/60" colSpan={6}>
                  暂无绑定记录。
                </td>
              </tr>
            ) : (
              records.map((row) => {
                const draft = drafts[row.channelId] ?? {
                  ownerId: row.ownerId,
                  enabled: row.enabled,
                  note: row.note ?? '',
                };
                return (
                  <tr key={row.channelId} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono text-white/90">{row.channelId}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={draft.ownerId}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.channelId]: { ...draft, ownerId: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                        />
                        <p className="text-xs text-white/50">{row.ownerDisplayName?.trim() || '未知用户'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.channelId]: { ...draft, note: event.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-white/80">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.channelId]: { ...draft, enabled: event.target.checked },
                            }))
                          }
                        />
                        {draft.enabled ? '启用' : '停用'}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {new Date(row.updatedAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSave(row.channelId)}
                          disabled={busyId === row.channelId}
                          className="rounded-full border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-60"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row.channelId)}
                          disabled={busyId === row.channelId}
                          className="rounded-full border border-rose-400/40 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-60"
                        >
                          删除
                        </button>
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
