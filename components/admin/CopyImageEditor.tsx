'use client';

/* eslint-disable @next/next/no-img-element */
import { useId, useRef, useState } from 'react';
import { isUploadedCopyImage, type EditableCopyEntry } from '@/lib/editable-copy-contract';
import type { CopyUnit } from '@/lib/editable-copy-units';
import type { CopyImageSlot } from '@/lib/editable-copy-images';

export type CopyImageUploadState = { pending: boolean; error?: string; success?: boolean };
export type CopyImageUploadHandler = (entry: EditableCopyEntry, file: File) => void | Promise<void>;
const buttonClass = 'rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';
const placementLabels = { image: '图片', thumbnail: '缩略图', background: '背景图' } as const;

export function CopyUnitImages({ unit, overrides, mode, placement }: {
  unit: CopyUnit; overrides: Record<string, string>; mode: 'edit' | 'preview' | 'default';
  placement: CopyImageSlot['placement'];
}) {
  const slots = (unit.images ?? []).filter(slot => slot.placement === placement);
  const entries = new Map(unit.entries.map(entry => [entry.key, entry]));
  if (!slots.length) return null;
  return <div className={placement === 'background' ? 'pointer-events-none absolute inset-0 overflow-hidden rounded-xl' : placement === 'thumbnail' ? 'relative z-10 float-right mb-3 ml-4 flex max-w-[35%] flex-wrap justify-end gap-2' : 'relative z-10 clear-both space-y-3 pt-4'}>
    {slots.map(slot => {
      const entry = entries.get(slot.key);
      if (entry?.kind !== 'image') return null;
      const fallback = slot.defaultSrc ?? entry.defaultText;
      const override = overrides[slot.key];
      const source = mode !== 'default' && isUploadedCopyImage(override) ? override : fallback;
      if (!source) return null;
      return <img key={slot.key} src={source} alt={placement === 'background' ? '' : entry.label}
        aria-hidden={placement === 'background' ? true : undefined}
        data-copy-image-key={slot.key} data-copy-image-placement={placement}
        className={placement === 'background' ? 'absolute inset-0 h-full w-full object-cover' : placement === 'thumbnail' ? 'h-20 w-20 rounded-lg object-contain' : 'mx-auto max-h-80 w-full rounded-lg object-contain'} />;
    })}
  </div>;
}

function CopyImageField({ entry, label, customized, disabled, upload, onUpload, onReset }: {
  entry: EditableCopyEntry; label: string; customized: boolean; disabled: boolean;
  upload?: CopyImageUploadState; onUpload?: CopyImageUploadHandler; onReset?: (entry: EditableCopyEntry) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const activeUpload = useRef(false);
  const [localPending, setLocalPending] = useState(false);
  const statusId = useId();
  const pending = localPending || Boolean(upload?.pending);
  const chooseFile = async (file: File) => {
    if (!onUpload || disabled || upload?.pending || activeUpload.current) return;
    activeUpload.current = true;
    setLocalPending(true);
    try { await onUpload(entry, file); }
    catch { /* The parent maps upload errors and owns the draft. */ }
    finally { activeUpload.current = false; setLocalPending(false); }
  };
  return <div className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-3" data-copy-image-editor={entry.key}>
    <p className="text-sm font-medium text-white/80">{label}</p>
    <div className="flex flex-wrap gap-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="hidden" tabIndex={-1}
        aria-label={label} disabled={disabled || pending || !onUpload}
        onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void chooseFile(file); }} />
      <button type="button" className={buttonClass} disabled={disabled || pending || !onUpload} aria-describedby={statusId}
        onClick={() => { if (!activeUpload.current) input.current?.click(); }}>更换图片</button>
      <button type="button" className={buttonClass} disabled={disabled || pending || !customized || !onReset}
        onClick={() => { if (!activeUpload.current && !upload?.pending) onReset?.(entry); }}>恢复默认图片</button>
    </div>
    <p className="text-xs text-white/45">支持 JPG、PNG、WebP、GIF，单张不超过 50MB。</p>
    <div id={statusId} aria-live="polite" className="text-xs">
      {pending ? <p className="text-white/60">正在上传…</p>
        : upload?.error ? <p role="alert" className="text-rose-300">{upload.error}</p>
        : upload?.success ? <p className="text-cyan-200">图片已上传，保存并发布后生效。</p> : null}
    </div>
  </div>;
}

export function CopyImageEditor({ unit, overrides, disabled = false, imageUploads = {}, onUpload, onResetImage }: {
  unit: CopyUnit; overrides: Record<string, string>; disabled?: boolean;
  imageUploads?: Record<string, CopyImageUploadState>;
  onUpload?: CopyImageUploadHandler; onResetImage?: (entry: EditableCopyEntry) => void;
}) {
  const slots = unit.images ?? [];
  if (!slots.length) return null;
  const entries = new Map(unit.entries.map(entry => [entry.key, entry]));
  const positions = { image: 0, thumbnail: 0, background: 0 };
  return <div className="space-y-3">{slots.map(slot => {
    const entry = entries.get(slot.key);
    if (entry?.kind !== 'image') return null;
    const ordinal = ++positions[slot.placement];
    const total = slots.filter(item => item.placement === slot.placement).length;
    const label = `${placementLabels[slot.placement]}${total > 1 ? ` ${ordinal}` : ''}`;
    return <CopyImageField key={slot.key} entry={entry} label={label} disabled={disabled}
      customized={Object.hasOwn(overrides, entry.key)} upload={imageUploads[entry.key]} onUpload={onUpload} onReset={onResetImage} />;
  })}</div>;
}
