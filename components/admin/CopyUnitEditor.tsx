'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderCopyTemplate, validateCopyOverrides, type EditableCopyEntry } from '@/lib/editable-copy-contract';
import { SITE_COPY_FIXED_VALUES } from '@/lib/editable-copy-catalog';
import type { CopyUnit, CopyUnitPart } from '@/lib/editable-copy-units';
import { changedCopyKeys, copyPreviewVariables, type CopyEditor } from './editable-copy-editor';
import { CopyImageEditor, CopyUnitImages, type CopyImageUploadHandler, type CopyImageUploadState } from './CopyImageEditor';

const buttonClass = 'rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';
const failedPreview = '模板尚未通过校验，修正后显示预览。';
const own = (values: Record<string, string>, key: string) => Object.hasOwn(values, key);
const failure = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试。';

function partClass(role: CopyUnitPart['role']) {
  if (role === 'title') return 'font-semibold text-lg text-white';
  if (role === 'button') return 'rounded-lg border border-white/15 bg-white/10 px-3 py-1 font-medium text-cyan-100';
  if (role === 'label') return 'font-medium text-white/70';
  if (role === 'footer') return 'text-xs text-white/50';
  return 'text-sm text-white/85';
}

function InlineCopyInput({ entry, value, part, inline, disabled, invalid, onEdit, onFocus }: {
  entry: EditableCopyEntry; value: string; part: CopyUnitPart; inline: boolean;
  disabled: boolean; invalid: boolean; onEdit: (value: string) => void; onFocus: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const resize = () => { node.style.height = '0px'; node.style.height = `${Math.max(28, node.scrollHeight)}px`; };
    resize();
    let width = node.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = node.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; resize(); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  const width = Math.max(6, Math.min(90, Array.from(value).reduce((sum, character) => sum + (/[^\x00-\x7F]/.test(character) ? 2 : 1), 0) + 2));
  return <textarea ref={ref} rows={1} value={value} disabled={disabled} aria-label={entry.label}
    data-copy-key={entry.key} aria-invalid={invalid} onFocus={onFocus}
    onChange={event => onEdit(event.target.value)}
    className={`inline-block max-w-full resize-none overflow-hidden align-middle bg-transparent leading-7 outline-none rounded px-1 focus:bg-cyan-200/5 focus:ring-1 focus:ring-cyan-200/60 disabled:opacity-50 ${partClass(part.role)} ${invalid ? 'ring-1 ring-rose-300/50' : ''}`}
    style={{ width: inline ? `calc(${width}ch + ${part.role === 'button' ? 24 : 8}px)` : '100%' }} />;
}

export function CopyUnitCanvas({ unit, overrides, mode, disabled = false, errors = {}, onEdit, onFocus }: {
  unit: CopyUnit; overrides: Record<string, string>; mode: 'edit' | 'preview' | 'default';
  disabled?: boolean; errors?: Record<string, string>;
  onEdit?: (entry: EditableCopyEntry, value: string) => void; onFocus?: (key: string) => void;
}) {
  const entries = new Map(unit.entries.map(entry => [entry.key, entry]));
  const showPreviewError = mode === 'preview' && unit.entries.some(entry => entry.kind !== 'image' && errors[entry.key]);
  return <div data-copy-unit={unit.id} data-copy-canvas={mode}
    className={`relative isolate max-h-[65vh] min-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl p-4 leading-7 sm:p-5 ${unit.kind === 'card' ? 'border-l-4 border-cyan-200/50 bg-slate-900' : unit.kind === 'section' ? 'border border-white/10 bg-black/15' : 'bg-black/20'}`}>
    <CopyUnitImages unit={unit} overrides={overrides} mode={mode} placement="background" />
    <CopyUnitImages unit={unit} overrides={overrides} mode={mode} placement="thumbnail" />
    <div className="relative z-10">{showPreviewError ? <p className="text-sm text-white/60">{failedPreview}</p> : unit.parts.map((part, index) => {
      const entry = part.key ? entries.get(part.key) : undefined;
      if (entry?.kind === 'image') return null;
      const template = entry ? mode === 'default' ? entry.defaultText : overrides[entry.key] ?? entry.defaultText : part.text ?? '';
      if (part.role === 'attribute') return entry && mode !== 'preview' ? <details key={`${part.key}:${index}`} className="mt-3 border-t border-white/10 pt-2 text-xs text-white/45">
        <summary className="cursor-pointer">{entry.label}</summary>
        {mode === 'edit' ? <InlineCopyInput entry={entry} part={part} value={template} inline={false} disabled={disabled} invalid={Boolean(errors[entry.key])}
          onFocus={() => onFocus?.(entry.key)} onEdit={value => onEdit?.(entry, value)} /> : <p>{template}</p>}
      </details> : null;
      let text = template;
      if (entry && mode === 'preview') {
        try { text = renderCopyTemplate(entry, template, { ...copyPreviewVariables(entry), ...part.examples, ...SITE_COPY_FIXED_VALUES[entry.key] }); }
        catch { text = failedPreview; }
      }
      const inline = part.role === 'button' || part.role === 'label' || part.separator === '' && index > 0 || unit.parts[index + 1]?.separator === '';
      return <span key={`${part.key ?? 'fixed'}:${index}`}>
        {part.separator && <span aria-hidden="true">{part.separator}</span>}
        {entry && mode === 'edit'
          ? <InlineCopyInput entry={entry} part={part} value={template} inline={inline} disabled={disabled} invalid={Boolean(errors[entry.key])}
            onFocus={() => onFocus?.(entry.key)} onEdit={value => onEdit?.(entry, value)} />
          : <span className={partClass(part.role)}>{text || (entry ? '（空）' : '')}</span>}
      </span>;
    })}</div>
    <CopyUnitImages unit={unit} overrides={overrides} mode={mode} placement="image" />
  </div>;
}

export function CopyUnitEditor({ unit, editor, categoryLabel, disabled, onEdit, onReset, onResolve, onUpload, onResetImage, imageUploads = {} }: {
  unit: CopyUnit; editor: CopyEditor; categoryLabel: string; disabled: boolean;
  onEdit: (entry: EditableCopyEntry, value: string) => void;
  onReset: () => void;
  onResolve: (use: 'mine' | 'published') => void;
  onUpload?: CopyImageUploadHandler;
  onResetImage?: (entry: EditableCopyEntry) => void;
  imageUploads?: Record<string, CopyImageUploadState>;
}) {
  const [activeKey, setActiveKey] = useState(unit.titleKey);
  const textEntries = unit.entries.filter(entry => entry.kind !== 'image');
  const activeEntry = textEntries.find(entry => entry.key === activeKey) ?? textEntries[0];
  const activeTemplate = activeEntry ? editor.draft[activeEntry.key] ?? activeEntry.defaultText : '';
  const uploading = (unit.images ?? []).some(slot => imageUploads[slot.key]?.pending);
  const unitDisabled = disabled || uploading;
  const customized = unit.keys.some(key => own(editor.draft, key));
  const dirty = new Set(changedCopyKeys(editor.server.overrides, editor.draft));
  const unsaved = unit.keys.some(key => dirty.has(key));
  const conflict = unit.keys.some(key => editor.conflicts.includes(key));
  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    for (const entry of unit.entries) {
      try { validateCopyOverrides([entry], own(editor.draft, entry.key) ? { [entry.key]: editor.draft[entry.key] } : {}); }
      catch (error) { found[entry.key] = failure(error); }
    }
    return found;
  }, [unit, editor.draft]);
  return <article className={`min-w-0 space-y-4 rounded-2xl border p-4 sm:p-5 ${conflict ? 'border-amber-300/50 bg-amber-300/5' : 'border-white/10 bg-white/5'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/45">{categoryLabel}</p>
        <h3 className="mt-1 break-words font-medium">{unit.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {customized && <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-200">自定义</span>}
          {unsaved && <span className="rounded bg-amber-300/10 px-2 py-1 text-amber-200">待发布</span>}
        </div>
      </div>
      <button type="button" className={buttonClass} disabled={unitDisabled || !customized} onClick={onReset}>恢复默认</button>
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <div className="min-w-0 space-y-3">
        {activeEntry && <><p className="text-xs text-white/45">编辑文案</p>
        <CopyUnitCanvas unit={unit} overrides={editor.draft} mode="edit" disabled={disabled} errors={errors} onEdit={onEdit} onFocus={setActiveKey} />
        <div className="space-y-2 rounded-xl bg-black/15 p-3">
          <div className="flex items-start justify-between gap-3 text-xs text-white/45"><p className="min-w-0 break-words">{activeEntry.label}</p><span className={activeTemplate.length > activeEntry.maxLength ? 'shrink-0 text-rose-300' : 'shrink-0'}>{activeTemplate.length} / {activeEntry.maxLength}</span></div>
          {errors[activeEntry.key] && <p role="alert" className="text-xs text-rose-300">{errors[activeEntry.key]}</p>}
          <p className="text-xs text-white/45">可用变量</p>
          {activeEntry.variables.length ? <div className="flex flex-wrap gap-2">{activeEntry.variables.map(variable => <code key={variable} className="rounded bg-white/10 px-2 py-1 text-xs text-cyan-100">{`{${variable}}`}{(activeEntry.requiredVariables ?? activeEntry.variables).includes(variable) ? ' · 必须保留' : ''}</code>)}</div> : <p className="text-xs text-white/60">这项文案没有可用变量。</p>}
        </div></>}
        <CopyImageEditor unit={unit} overrides={editor.draft} disabled={disabled} imageUploads={imageUploads} onUpload={onUpload} onResetImage={onResetImage} />
      </div>
      <div className="min-w-0 space-y-3"><p className="text-xs text-white/45">{activeEntry ? '文字预览 · 不发送消息' : '图片'}</p><CopyUnitCanvas unit={unit} overrides={editor.draft} mode="preview" errors={errors} /></div>
    </div>
    <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs text-white/45">默认原文</summary><div className="mt-3"><CopyUnitCanvas unit={unit} overrides={{}} mode="default" /></div></details>
    {conflict && <div className="space-y-3 rounded-xl border border-amber-300/20 p-3">
      <p className="text-sm text-amber-200">这项文案也被其他管理员修改，请选择本次保留哪一份。</p>
      <p className="text-xs text-white/45">最新已发布内容</p><CopyUnitCanvas unit={unit} overrides={editor.server.overrides} mode="preview" />
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={unitDisabled} onClick={() => onResolve('mine')}>保留我的文案</button><button type="button" className={buttonClass} disabled={unitDisabled} onClick={() => onResolve('published')}>采用已发布文案</button></div>
    </div>}
  </article>;
}
