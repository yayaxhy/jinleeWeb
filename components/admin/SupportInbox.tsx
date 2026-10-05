'use client';

import { useEffect, useState } from 'react';

type Summary = { id: string; userName: string; userDlmId: string | null; lastMessage: string; updatedAt: string };
type Thread = { id: string; userName: string; userDlmId: string | null; messages: Array<{ id: string; from: 'admin' | 'system' | 'user'; text: string; createdAt: string }> };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? '请求失败');
  return payload;
}

export function SupportInbox() {
  const [rows, setRows] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const result = await api<{ conversations: Summary[] }>('/api/admin/support-conversations');
      setRows(result.conversations ?? []);
    } catch (loadError) { setError((loadError as Error).message); }
  };
  useEffect(() => { void load(); }, []);

  const select = async (id: string) => {
    try {
      const result = await api<{ conversation: Thread }>(`/api/admin/support-conversations/${encodeURIComponent(id)}`);
      setSelected(result.conversation);
      setError(null);
    } catch (loadError) { setError((loadError as Error).message); }
  };
  const send = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const result = await api<{ conversation: Thread }>(`/api/admin/support-conversations/${encodeURIComponent(selected.id)}`, { method: 'POST', body: JSON.stringify({ text: draft.trim() }) });
      setSelected(result.conversation);
      setDraft('');
      await load();
    } catch (sendError) { setError((sendError as Error).message); } finally { setSending(false); }
  };

  return <div className="grid min-h-[580px] overflow-hidden rounded-2xl border border-white/10 lg:grid-cols-[340px_1fr]">
    <aside className="border-b border-white/10 bg-black/20 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><p className="font-semibold">客服会话</p><button type="button" onClick={() => void load()} className="text-xs text-white/60 hover:text-white">刷新</button></div><div className="max-h-[300px] overflow-y-auto lg:max-h-[620px]">{rows.map((row) => <button type="button" key={row.id} onClick={() => void select(row.id)} className={`block w-full border-b border-white/10 px-4 py-3 text-left hover:bg-white/5 ${selected?.id === row.id ? 'bg-white/10' : ''}`}><p className="truncate font-semibold">{row.userName}</p><p className="mt-1 truncate text-xs text-white/55">{row.lastMessage || '新建客服会话'}</p><p className="mt-1 text-[11px] text-white/40">{new Date(row.updatedAt).toLocaleString('zh-CN')}</p></button>)}{!rows.length ? <p className="px-4 py-8 text-sm text-white/55">暂无客服会话。</p> : null}</div></aside>
    <section className="flex min-h-[380px] flex-col">{selected ? <><header className="border-b border-white/10 px-5 py-4"><p className="font-semibold">{selected.userName}</p><p className="mt-1 text-xs text-white/55">{selected.userDlmId ?? '未绑定 DLM ID'}</p></header><div className="flex-1 space-y-3 overflow-y-auto bg-black/10 p-4">{selected.messages.map((message) => <div key={message.id} className={`flex ${message.from === 'admin' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 ${message.from === 'admin' ? 'bg-white text-black' : message.from === 'system' ? 'bg-amber-300/20 text-amber-100' : 'bg-white/10 text-white'}`}><p>{message.text}</p><p className="mt-1 text-[10px] opacity-55">{new Date(message.createdAt).toLocaleString('zh-CN')}</p></div></div>)}</div><div className="border-t border-white/10 p-3"><div className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void send(); } }} placeholder="以公会客服身份回复…" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none" /><button type="button" disabled={sending || !draft.trim()} onClick={() => void send()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">发送</button></div></div></> : <div className="grid flex-1 place-items-center p-6 text-sm text-white/55">选择一个会话以回复。</div>}</section>
    {error ? <p className="fixed bottom-4 right-4 rounded-xl bg-red-500 px-4 py-3 text-sm text-white shadow-xl">{error}</p> : null}
  </div>;
}
