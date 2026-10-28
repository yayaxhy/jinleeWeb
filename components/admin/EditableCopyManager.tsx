'use client';

import Link from 'next/link';
import { COPY_CATEGORIES, classifyCopyEntry, type CopyCategoryId } from './editable-copy-categories';
import { CopyUnitEditor } from './CopyUnitEditor';
import { filterCopyUnits, getCopyUnits, type CopyUnit } from '@/lib/editable-copy-units';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isUploadedCopyImage, validateCopyOverrides, type EditableCopyEntry } from '@/lib/editable-copy-contract';
import { COPY_IMAGE_MAX_BYTES, copyImageFailureMessage } from '@/lib/editable-copy-image-policy';
import {
  appendCopyHistory, changedCopyKeys, createCopyEditor,
  refreshCopyEditor, resolveCopyConflict, updateCopyDraft,
  type CopyEditor, type CopyScope, type CopyState, type CopyVersion,
} from './editable-copy-editor';

const PAGE_SIZE = 10;
type CategoryTab = CopyCategoryId | 'all' | 'images';
type ImageUpload = { pending: boolean; error?: string; success?: boolean };
const categoryTabs = [{ id: 'all' as const, label: '全部' }, { id: 'images' as const, label: '带图片' }, ...COPY_CATEGORIES];
const categoryLabels = Object.fromEntries(COPY_CATEGORIES.map(({ id, label }) => [id, label]));
const scopeLabels: Record<CopyScope, string> = { bot: 'Discord Bot', site: '网站' };
const inputClass = 'w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70 disabled:opacity-50';
const buttonClass = 'rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

class CopyRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
class CopyImageUploadError extends Error {}

async function requestCopy(scope: CopyScope, init?: RequestInit, beforeVersion?: number): Promise<CopyState> {
  const params = new URLSearchParams({ scope });
  if (beforeVersion !== undefined) params.set('beforeVersion', String(beforeVersion));
  const response = await fetch(`/api/admin/copy?${params}`, {
    ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  let payload: CopyState & { message?: string; error?: string };
  try { payload = await response.json(); }
  catch { throw new CopyRequestError('服务器没有返回有效结果，请刷新后核对已发布版本。', response.ok ? 503 : response.status || 503); }
  if (!response.ok || !payload.ok) {
    const fallback = response.status === 409 ? '其他管理员已更新文案，你的输入已保留。请刷新并核对冲突。'
      : response.status === 403 ? '当前账号没有文案管理权限。'
      : '文案服务暂时不可用，请稍后重试。';
    throw new CopyRequestError(payload.message || fallback, response.status);
  }
  if (payload.scope !== scope || !Array.isArray(payload.catalog) || !Number.isSafeInteger(payload.revision) || !payload.overrides || typeof payload.overrides !== 'object') {
    throw new CopyRequestError('返回的文案配置不完整，请刷新后重试。', 503);
  }
  return payload;
}

function errorText(error: unknown) { return error instanceof Error ? error.message : '请求失败，请稍后重试。'; }
function versionLabel(version: number) { return version ? `v${version}` : '默认文案'; }

function unitCategory(unit: CopyUnit) {
  return classifyCopyEntry(unit.entries.find(entry => entry.key === unit.titleKey) ?? unit.entries[0]);
}

function unitSummary(unit: CopyUnit) {
  const entries = new Map(unit.entries.map(entry => [entry.key, entry]));
  return unit.parts.filter(part => part.key !== unit.titleKey && part.role !== 'attribute').map(part => {
    const template = part.key ? entries.get(part.key)?.defaultText ?? '' : part.text ?? '';
    return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, variable: string) => String(part.examples?.[variable] ?? match));
  }).join(' ');
}

function UnitThumbnail({ unit, overrides }: { unit: CopyUnit; overrides: Record<string, string> }) {
  const slot = unit.images.find(image => image.placement === 'image') ?? unit.images[0];
  if (!slot) return null;
  const entry = unit.entries.find(item => item.key === slot.key);
  const src = overrides[slot.key] ?? entry?.defaultText ?? slot.defaultSrc;
  // Uploaded media and registered defaults are validated before reaching here.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" loading="lazy" className="mt-2 h-20 w-full rounded-lg bg-black/20 object-contain" /> : null;
}

export function EditableCopyManager() {
  const [scope, setScope] = useState<CopyScope>('bot');
  const [editors, setEditors] = useState<Partial<Record<CopyScope, CopyEditor>>>({});
  const [busy, setBusy] = useState<Partial<Record<CopyScope, string>>>({});
  const [messages, setMessages] = useState<Partial<Record<CopyScope, { text: string; failed?: boolean }>>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryTab>('all');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [reasons, setReasons] = useState<Partial<Record<CopyScope, string>>>({});
  const [rollbackTarget, setRollbackTarget] = useState<{ scope: CopyScope; value: CopyVersion } | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const requests = useRef<Record<CopyScope, number>>({ bot: 0, site: 0 });
  const [imageUploads, setImageUploads] = useState<Partial<Record<CopyScope, Record<string, ImageUpload>>>>({});
  const uploadRequests = useRef<Record<string, number>>({});
  const pendingUploads = useRef(new Set<string>());
  const editor = editors[scope];
  const operation = busy[scope];
  const message = messages[scope];
  const reason = reasons[scope] ?? '';
  const scopeUploads = imageUploads[scope] ?? {};
  const uploading = Object.values(scopeUploads).some(upload => upload.pending);
  const updateEditor = (target: CopyScope, update: (current: CopyEditor) => CopyEditor) => setEditors((current) => current[target] ? { ...current, [target]: update(current[target]!) } : current);

  const refresh = useCallback(async (target: CopyScope, signal?: AbortSignal) => {
    const request = ++requests.current[target];
    setBusy((current) => ({ ...current, [target]: 'refresh' }));
    try {
      const data = await requestCopy(target, { signal });
      if (signal?.aborted || request !== requests.current[target]) return;
      setEditors((current) => ({ ...current, [target]: refreshCopyEditor(current[target], data) }));
      setMessages((current) => ({ ...current, [target]: { text: '已读取最新文案。本地未发布修改已保留；同项冲突需要逐项选择。' } }));
    } catch (error) {
      if (signal?.aborted || request !== requests.current[target]) return;
      setMessages((current) => ({ ...current, [target]: { text: errorText(error), failed: true } }));
    } finally {
      if (!signal?.aborted && request === requests.current[target]) setBusy((current) => ({ ...current, [target]: undefined }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(scope, controller.signal);
    return () => controller.abort();
  }, [scope, refresh]);

  const dirtyKeys = editor ? changedCopyKeys(editor.server.overrides, editor.draft) : [];
  useEffect(() => {
    if (!Object.values(editors).some((value) => value && changedCopyKeys(value.server.overrides, value.draft).length)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editors]);

  const catalog = editor?.server.catalog;
  const units = useMemo(() => catalog ? getCopyUnits(scope, catalog) : [], [scope, catalog]);
  const matchingUnits = useMemo(() => editor ? filterCopyUnits(units, {
    query, modifiedOnly, conflictsOnly, overrides: editor.draft, conflicts: editor.conflicts,
  }) : [], [units, editor, query, modifiedOnly, conflictsOnly]);
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CategoryTab, number>> = { all: matchingUnits.length, images: matchingUnits.filter(unit => unit.images.length).length };
    for (const unit of matchingUnits) {
      if (unit.images.length) continue;
      const id = unitCategory(unit);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [matchingUnits]);
  const filtered = useMemo(() => category === 'all' ? matchingUnits
    : matchingUnits.filter(unit => category === 'images' ? unit.images.length > 0 : !unit.images.length && unitCategory(unit) === category), [matchingUnits, category]);
  const categoryLabel = category === 'all' ? '全部文案' : category === 'images' ? '带图片' : categoryLabels[category];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedUnit = visible.find(unit => `${scope}:${unit.id}` === selectedUnitId) ?? visible[0];
  const dirty = new Set(dirtyKeys);
  const dirtyUnitCount = units.filter(unit => unit.keys.some(key => dirty.has(key))).length;
  const customizedUnitCount = editor ? units.filter(unit => unit.keys.some(key => Object.hasOwn(editor.draft, key))).length : 0;
  const validation = useMemo(() => {
    if (!editor) return { error: '', overrides: null };
    try { return { error: '', overrides: validateCopyOverrides(editor.server.catalog, editor.draft) }; }
    catch (error) { return { error: errorText(error), overrides: null }; }
  }, [editor]);
  const writable = Boolean(editor?.server.enabled && !operation && !uploading && !editor.needsRefresh && !editor.conflicts.length);
  const canPublish = writable && dirtyKeys.length > 0 && Boolean(validation.overrides) && reason.trim().length <= 300;

  const mutate = async (action: 'publish' | 'rollback') => {
    if (!editor || !writable || [...pendingUploads.current].some(key => key.startsWith(`${scope}:`))) return;
    const target = rollbackTarget?.scope === scope ? rollbackTarget.value : null;
    if (action === 'publish' && !canPublish) return;
    if (action === 'rollback' && (!target || dirtyKeys.length || rollbackReason.trim().length > 300)) return;
    const targetScope = scope;
    setBusy((current) => ({ ...current, [targetScope]: action }));
    try {
      const data = await requestCopy(targetScope, {
        method: 'POST', body: JSON.stringify({ scope: targetScope, action, expectedRevision: editor.server.revision, imageSchemaVersion: 1,
          ...(action === 'publish' ? { overrides: validation.overrides, reason: reason.trim() } : { targetVersion: target!.version, reason: rollbackReason.trim() }),
        }),
      });
      setEditors((current) => ({ ...current, [targetScope]: createCopyEditor(data) }));
      setImageUploads(current => ({ ...current, [targetScope]: {} }));
      setMessages((current) => ({ ...current, [targetScope]: { text: `${action === 'publish' ? '已保存并发布' : '已将历史内容发布为新版本'} ${versionLabel(data.activeVersion)}。${targetScope === 'bot' ? 'Bot 正常运行时约 15 秒加载新文案' : '网站后续读取时使用新文案'}，历史消息不会批量重写。` } }));
      if (action === 'publish') setReasons((current) => ({ ...current, [targetScope]: '' }));
      else { setRollbackTarget(null); setRollbackReason(''); }
    } catch (error) {
      const mustRefresh = !(error instanceof CopyRequestError) || error.status === 409 || error.status >= 500;
      if (mustRefresh) updateEditor(targetScope, (current) => ({ ...current, needsRefresh: true }));
      setMessages((current) => ({ ...current, [targetScope]: { text: `${errorText(error)}${mustRefresh ? ' 输入已保留；请先刷新核对，再继续发布。' : ''}`, failed: true } }));
    } finally { setBusy((current) => ({ ...current, [targetScope]: undefined })); }
  };

  const clearImageUpload = (target: CopyScope, key: string) => {
    const requestKey = `${target}:${key}`;
    uploadRequests.current[requestKey] = (uploadRequests.current[requestKey] ?? 0) + 1;
    pendingUploads.current.delete(requestKey);
    setImageUploads(current => {
      const next = { ...current[target] };
      delete next[key];
      return { ...current, [target]: next };
    });
  };

  const uploadImage = async (entry: EditableCopyEntry, file: File) => {
    if (!editor || operation || entry.kind !== 'image') return;
    const target = scope;
    const requestKey = `${target}:${entry.key}`;
    if (pendingUploads.current.has(requestKey)) return;
    const request = (uploadRequests.current[requestKey] ?? 0) + 1;
    uploadRequests.current[requestKey] = request;
    const initialPublished = editor.server.overrides[entry.key];
    const setUpload = (upload: ImageUpload) => {
      if (uploadRequests.current[requestKey] !== request) return;
      setImageUploads(current => ({ ...current, [target]: { ...current[target], [entry.key]: upload } }));
    };
    if (!file.size || file.size > COPY_IMAGE_MAX_BYTES) {
      setUpload({ pending: false, error: copyImageFailureMessage(file.size ? 'too_large' : 'unreadable') });
      return;
    }
    pendingUploads.current.add(requestKey);
    setUpload({ pending: true });
    try {
      const response = await fetch(`/api/admin/copy/images?${new URLSearchParams({ scope: target, key: entry.key })}`, {
        method: 'POST', body: file, cache: 'no-store',
      });
      const payload: { ok?: boolean; url?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new CopyImageUploadError(copyImageFailureMessage(payload.error ?? (response.status === 413 ? 'too_large' : response.status === 403 ? 'forbidden' : undefined)));
      if (!isUploadedCopyImage(payload.url)) throw new CopyImageUploadError(copyImageFailureMessage('missing'));
      if (uploadRequests.current[requestKey] !== request) return;
      const url = payload.url;
      updateEditor(target, current => {
        const next = updateCopyDraft(current, entry, url);
        // A refresh may have loaded another publication while this file was
        // uploading. Preserve both choices through the existing conflict UI.
        if (current.server.overrides[entry.key] !== initialPublished && current.server.overrides[entry.key] !== url) {
          next.conflicts = [...new Set([...next.conflicts, entry.key])];
        }
        return next;
      });
      setUpload({ pending: false, success: true });
    } catch (error) {
      setUpload({ pending: false, error: error instanceof CopyImageUploadError ? error.message : copyImageFailureMessage('upload_failed') });
    } finally {
      if (uploadRequests.current[requestKey] === request) pendingUploads.current.delete(requestKey);
    }
  };

  const loadMoreHistory = async () => {
    const beforeVersion = editor?.server.nextBeforeVersion;
    if (operation || beforeVersion === null || beforeVersion === undefined) return;
    const target = scope;
    setBusy((current) => ({ ...current, [target]: 'history' }));
    try {
      const data = await requestCopy(target, undefined, beforeVersion);
      updateEditor(target, (current) => ({ ...current, server: { ...current.server, history: appendCopyHistory(current.server.history, data.history), nextBeforeVersion: data.nextBeforeVersion } }));
    } catch (error) { setMessages((current) => ({ ...current, [target]: { text: errorText(error), failed: true } })); }
    finally { setBusy((current) => ({ ...current, [target]: undefined })); }
  };

  return <div className="mx-auto max-w-7xl space-y-6 text-white" aria-busy={Boolean(operation)}>
    <header className="space-y-3"><Link href="/admin" className="text-sm text-white/55 hover:text-white">← 返回管理后台</Link><h1 className="text-2xl font-semibold">文案管理</h1>
      <nav aria-label="其他内容编辑入口" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-cyan-200"><Link href="/admin/gifts" className="hover:underline">礼物名称与分类 ↗</Link></nav>
    </header>
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5" aria-label="搜索和筛选文案">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2" aria-label="文案范围">{(['bot', 'site'] as const).map((value) => <button type="button" key={value} disabled={Boolean(operation)} aria-pressed={scope === value} className={`${buttonClass} ${scope === value ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100' : ''}`} onClick={() => { if (value !== scope) { setScope(value); setCategory('all'); setPage(0); setConflictsOnly(false); } }}>{scopeLabels[value]}{editors[value] && changedCopyKeys(editors[value]!.server.overrides, editors[value]!.draft).length ? ' · 待发布' : ''}</button>)}</div><button type="button" disabled={Boolean(operation)} className={buttonClass} onClick={() => void refresh(scope)}>刷新并保留修改</button></div>
      <label className="block space-y-2"><span className="text-xs text-white/60">搜索文案</span><input type="search" className={inputClass} value={query} placeholder="输入原文或关键词，例如：充值、打赏" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-white/50"><span>按业务分类</span></div>
        <div role="tablist" aria-label="文案业务分类" className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible" onKeyDown={(event) => {
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index = tabs.indexOf(event.target as HTMLButtonElement);
          if (index < 0) return;
          const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
          if (nextIndex < 0) return;
          event.preventDefault();
          tabs[nextIndex].focus();
          tabs[nextIndex].click();
        }}>
          {categoryTabs.map(({ id, label }) => <button type="button" role="tab" key={id} id={`copy-category-${scope}-${id}`}
            aria-selected={category === id} aria-controls={`copy-category-panel-${scope}`} tabIndex={category === id ? 0 : -1}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${category === id ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 text-white/60 hover:border-white/25 hover:bg-white/5 hover:text-white'}`}
            onClick={() => { setCategory(id); setPage(0); }}>
            {label}<span className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${category === id ? 'bg-cyan-300/15 text-cyan-100' : 'bg-white/5 text-white/45'}`}>{categoryCounts[id] ?? 0}</span>
          </button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex items-center gap-2 text-white/70"><input type="checkbox" checked={modifiedOnly} onChange={(event) => { setModifiedOnly(event.target.checked); setPage(0); }} />只看自定义文案</label><p className="text-white/45">{editor ? `${units.length} 项文案 · ${customizedUnitCount} 项自定义 · 当前 ${versionLabel(editor.server.activeVersion)}` : '等待加载文案…'}</p></div>
    </section>
    {message && <p role={message.failed ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm leading-6 ${message.failed ? 'border-rose-300/25 bg-rose-300/5 text-rose-200' : 'border-cyan-300/20 bg-cyan-300/5 text-cyan-100'}`}>{message.text}</p>}
    {editor && !editor.server.enabled && <p role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-100">文案配置尚未启用。可以搜索、编辑和预览，启用后才能保存并发布。</p>}
    {editor?.needsRefresh && <p role="alert" className="text-sm text-amber-200">发布状态需要核对。点击“刷新并保留修改”后再继续。</p>}
    {(Boolean(editor?.conflicts.length) || conflictsOnly) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/30 p-3"><p className="text-sm text-amber-200">{editor?.conflicts.length ? `有 ${editor.conflicts.length} 项并发修改冲突，选择内容后才能发布。` : '所有冲突已处理，可以返回全部文案。'}</p><button type="button" className={buttonClass} onClick={() => { setConflictsOnly(!conflictsOnly); setQuery(''); setCategory('all'); setModifiedOnly(false); setPage(0); }}>{conflictsOnly ? '显示全部文案' : '只看冲突'}</button></div>}
    {validation.error && <p role="alert" className="text-sm text-rose-200">尚不能发布：{validation.error}</p>}
    <section role="tabpanel" id={`copy-category-panel-${scope}`} aria-labelledby={`copy-category-${scope}-${category}`} tabIndex={0} className="space-y-4 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
      <div className="flex items-center justify-between gap-3"><h2 className="font-medium">{categoryLabel}</h2><p role="status" className="text-sm text-white/45">{editor ? `${filtered.length} 项文案` : '正在加载…'}</p></div>
      {editor && selectedUnit && <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label={categoryLabel} className="flex max-h-[70vh] gap-2 overflow-auto rounded-2xl border border-white/10 bg-white/[0.025] p-2 lg:flex-col">
          {visible.map(unit => <button type="button" key={`${scope}:${unit.id}`} aria-pressed={unit.id === selectedUnit.id}
            className={`w-52 shrink-0 rounded-xl border p-3 text-left transition-colors lg:w-auto ${unit.id === selectedUnit.id ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-50' : 'border-transparent text-white/70 hover:bg-white/5'}`}
            onClick={() => setSelectedUnitId(`${scope}:${unit.id}`)}>
            <span className="block text-xs text-white/40">{categoryLabels[unitCategory(unit)]}</span>
            <span className="mt-1 line-clamp-3 break-words text-sm leading-6">{unit.title}</span>
            <UnitThumbnail unit={unit} overrides={editor.draft} />
            <span className="mt-1 line-clamp-2 break-words text-xs leading-5 text-white/40">{unitSummary(unit)}</span>
            {unit.keys.some(key => dirty.has(key)) && <span className="mt-2 inline-block text-xs text-amber-200">待发布</span>}
          </button>)}
        </nav>
        <CopyUnitEditor key={`${scope}:${selectedUnit.id}`} unit={selectedUnit} editor={editor} categoryLabel={categoryLabels[unitCategory(selectedUnit)]}
          disabled={Boolean(operation)} onEdit={(item, value) => updateEditor(scope, current => updateCopyDraft(current, item, value))}
          imageUploads={scopeUploads} onUpload={uploadImage}
          onResetImage={entry => { clearImageUpload(scope, entry.key); updateEditor(scope, current => updateCopyDraft(current, entry, entry.defaultText)); }}
          onReset={() => {
            for (const image of selectedUnit.images) clearImageUpload(scope, image.key);
            updateEditor(scope, current => selectedUnit.entries.reduce((next, entry) => updateCopyDraft(next, entry, entry.defaultText), current));
          }}
          onResolve={use => {
            if (use === 'published') for (const image of selectedUnit.images) clearImageUpload(scope, image.key);
            updateEditor(scope, current => selectedUnit.keys.filter(key => current.conflicts.includes(key)).reduce((next, key) => resolveCopyConflict(next, key, use), current));
          }} />
      </div>}
      {editor && !filtered.length && <p className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-white/50">{editor.server.catalog.length ? '没有匹配的文案，请调整搜索或筛选。' : '当前范围暂无可编辑文案。'}</p>}
    </section>
    {filtered.length > PAGE_SIZE && <nav aria-label="文案分页" className="flex items-center justify-center gap-4"><button type="button" className={buttonClass} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span className="text-sm text-white/60">{currentPage + 1} / {pages} · {filtered.length} 项</span><button type="button" className={buttonClass} disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></nav>}
    <section className="sticky bottom-3 z-10 space-y-3 rounded-2xl border border-white/20 bg-slate-950/95 p-4 shadow-xl backdrop-blur" aria-label="发布文案">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{scopeLabels[scope]} · {dirtyKeys.length ? `${dirtyUnitCount} 项修改待发布` : '没有待发布修改'}</p><div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={!editor || Boolean(operation) || uploading || !dirtyKeys.length || editor.needsRefresh} onClick={() => { if (editor && ![...pendingUploads.current].some(key => key.startsWith(`${scope}:`))) { setEditors((current) => ({ ...current, [scope]: createCopyEditor(editor.server) })); setImageUploads(current => ({ ...current, [scope]: {} })); setRollbackTarget(null); } }}>放弃修改，载入已发布文案</button><button type="button" disabled={!canPublish} onClick={() => void mutate('publish')} className="rounded-full bg-cyan-200 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">{operation === 'publish' ? '正在发布…' : '保存并发布'}</button></div></div>
      <label className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="shrink-0 text-xs text-white/50">修改原因（选填）</span><input value={reason} maxLength={300} disabled={Boolean(operation)} className={inputClass} placeholder="例如：更新活动欢迎语" onChange={(event) => setReasons((current) => ({ ...current, [scope]: event.target.value }))} /></label>
    </section>
    <section className="space-y-4 rounded-2xl border border-white/10 p-4 sm:p-5" aria-label="文案历史版本"><div><h2 className="font-semibold">{scopeLabels[scope]}历史版本</h2></div>
      {editor?.server.history.length ? <ul className="divide-y divide-white/10">{editor.server.history.map((item) => <li key={item.version} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="space-y-1"><p className="text-sm">v{item.version}{item.version === editor.server.activeVersion ? ' · 当前发布' : ''} · {Object.keys(item.overrides).length} 项自定义</p><p className="text-xs text-white/50">{new Date(item.createdAt).toLocaleString()} · {item.actorId}</p>{item.reason && <p className="break-words text-xs text-white/70">{item.reason}</p>}{!!item.ignoredKeys?.length && <p className="text-xs text-amber-200">此版本有 {item.ignoredKeys.length} 项文案已移除或不兼容，回滚仅恢复兼容内容。</p>}</div><button type="button" className={buttonClass} disabled={!writable || dirtyKeys.length > 0 || item.version === editor.server.activeVersion} onClick={() => { setRollbackTarget({ scope, value: item }); setRollbackReason(''); }}>选择此版本回滚</button></li>)}</ul> : <p className="text-sm text-white/50">暂无发布历史。</p>}
      {rollbackTarget?.scope === scope && <div className="space-y-3 rounded-xl border border-amber-200/30 bg-amber-200/5 p-4"><p className="text-sm text-amber-100">将恢复 v{rollbackTarget.value.version} 的文案，影响 {editor ? changedCopyKeys(editor.server.overrides, rollbackTarget.value.overrides).length : 0} 项设置。</p><label className="block space-y-2"><span className="text-xs text-white/60">回滚原因（选填）</span><input maxLength={300} value={rollbackReason} className={inputClass} disabled={Boolean(operation)} onChange={(event) => setRollbackReason(event.target.value)} /></label><div className="flex gap-2"><button type="button" className={buttonClass} disabled={!writable || dirtyKeys.length > 0} onClick={() => void mutate('rollback')}>{operation === 'rollback' ? '正在回滚…' : '发布回滚'}</button><button type="button" className={buttonClass} disabled={Boolean(operation)} onClick={() => setRollbackTarget(null)}>取消</button></div></div>}
      {editor?.server.nextBeforeVersion !== null && editor?.server.nextBeforeVersion !== undefined && <button type="button" className={buttonClass} disabled={Boolean(operation)} onClick={() => void loadMoreHistory()}>加载更早版本</button>}
    </section>
  </div>;
}
