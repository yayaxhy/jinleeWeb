'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { PointShopAdminData, PointShopAdminItem } from '@/lib/point-shop-admin-types';
import { COPY_IMAGE_MAX_BYTES, copyImageFailureMessage } from '@/lib/editable-copy-image-policy';
import { PointShopProductImage } from '@/components/profile/PointShopProductImage';

const endpoint = '/api/admin/point-shop';
const button = 'rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400';
const input = 'w-full rounded-xl border border-white/20 bg-[#15141c] px-3 py-2 text-white disabled:opacity-50 focus:outline-2 focus:outline-violet-400';
const displayDiscount = (rate: string) => String(Number((Number(rate) * 10).toFixed(3)));

type Editor = {
  original: PointShopAdminItem | null;
  name: string; description: string; pointsCost: string; stock: string; unlimited: boolean;
  couponExpireDays: string; sortOrder: string; isActive: boolean;
  kind: 'ORDER_DISCOUNT' | 'GIFT'; discount: string; maxDiscountAmount: string;
  giftName: string; free: boolean;
  imageUrl: string | null;
};
function openEditor(item: PointShopAdminItem | null): Editor {
  const rule = item?.voucherRule;
  return {
    original: item, name: item?.name ?? '', description: item?.description ?? '',
    imageUrl: item?.imageUrl ?? null,
    pointsCost: item?.pointsCost ?? '', stock: String(item?.stock ?? 0), unlimited: item?.stock == null,
    couponExpireDays: String(item?.couponExpireDays ?? 30), sortOrder: String(item?.sortOrder ?? 0),
    isActive: item?.isActive ?? false, kind: rule?.kind ?? 'ORDER_DISCOUNT',
    discount: rule ? displayDiscount(rule.payRate) : '9',
    maxDiscountAmount: rule?.kind === 'ORDER_DISCOUNT' ? rule.maxDiscountAmount : '',
    giftName: rule?.kind === 'GIFT' ? rule.giftName : '', free: rule?.kind === 'GIFT' ? rule.payRate === '0' : true,
  };
}

export function PointShopAdminManager() {
  const baseId = useId();
  const [data, setData] = useState<PointShopAdminData | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function load(signal?: AbortSignal) {
    const response = await fetch(endpoint, { cache: 'no-store', signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '操作失败，请重试');
    setData(result);
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) setMessage({ error: true, text: error instanceof Error ? error.message : '操作失败，请重试' });
    });
    return () => controller.abort();
  }, []);

  function change<K extends keyof Editor>(key: K, value: Editor[K]) {
    setEditor((current) => current ? { ...current, [key]: value } : null);
  }
  async function uploadImage(file: File) {
    if (busy || uploadInFlight.current) return;
    uploadInFlight.current = true;
    setUploading(true);
    setMessage(null);
    try {
      if (file.size > COPY_IMAGE_MAX_BYTES) throw new Error(copyImageFailureMessage('too_large'));
      const response = await fetch(`${endpoint}/image`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || typeof result.url !== 'string') {
        const known = ['too_large', 'unsupported', 'unreadable', 'dimensions', 'missing'].includes(result.error);
        throw new Error(copyImageFailureMessage(known ? result.error : 'upload_failed'));
      }
      change('imageUrl', result.url);
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error && error.message.startsWith('图片') ? error.message : copyImageFailureMessage('upload_failed') });
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  }
  async function write(payload: Record<string, unknown>, create: boolean, success: string) {
    if (busy || uploadInFlight.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: create ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(result.error || '操作失败，请重试');
      }
      setEditor(null);
      await load();
      setMessage({ text: success, error: false });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : '操作失败，请重试' });
    } finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    if (editor.original?.canEditVoucher === false) {
      void write({ action: 'image', id: editor.original.id, expectedUpdatedAt: editor.original.updatedAt, imageUrl: editor.imageUrl }, false, '已保存');
      return;
    }
    const legacy = !!editor.original && !editor.original.voucherRule;
    const rate = editor.kind === 'GIFT' && editor.free ? '0' : (Number(editor.discount) / 10).toFixed(4);
    const voucherRule = legacy ? null : editor.kind === 'ORDER_DISCOUNT'
      ? { version: 1, kind: 'ORDER_DISCOUNT', payRate: rate, maxDiscountAmount: editor.maxDiscountAmount }
      : { version: 1, kind: 'GIFT', payRate: rate, giftName: editor.giftName };
    void write({
      id: editor.original?.id, expectedUpdatedAt: editor.original?.updatedAt,
      name: editor.name, description: editor.description, pointsCost: editor.pointsCost,
      imageUrl: editor.imageUrl,
      stock: editor.unlimited ? null : Number(editor.stock), couponExpireDays: Number(editor.couponExpireDays),
      sortOrder: Number(editor.sortOrder), isActive: editor.isActive, voucherRule,
    }, !editor.original, '已保存');
  }

  const field = (key: keyof Editor, label: string, control: React.ReactNode) => <div className="space-y-2">
    <label htmlFor={`${baseId}-${key}`} className="text-sm text-white/75">{label}</label>{control}
  </div>;
  const numberField = (key: 'pointsCost' | 'stock' | 'couponExpireDays' | 'sortOrder' | 'discount' | 'maxDiscountAmount', label: string, min: string, step = '1', max?: string) =>
    field(key, label, <input id={`${baseId}-${key}`} className={input} type="number" min={min} max={max} step={step} required
      value={editor?.[key] ?? ''} onChange={(event) => change(key, event.target.value)} />);
  const legacy = !!editor?.original && !editor.original.voucherRule;
  const imageOnly = editor?.original?.canEditVoucher === false;
  const working = busy || uploading;

  return <div className="space-y-6" aria-busy={working || !data}>
    {message && <p role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${message.error ? 'border-red-400/30 text-red-200' : 'border-emerald-400/30 text-emerald-200'}`}>{message.text}</p>}
    <button className={button} disabled={working || !data} onClick={() => { setEditor(openEditor(null)); setMessage(null); }}>新增券</button>

    {editor && <form onSubmit={save} className="space-y-5 rounded-2xl border border-white/15 bg-white/5 p-5">
      <h2 className="text-xl font-semibold">{editor.original ? '编辑' : '新增券'}</h2>
      {imageOnly && <p className="break-words text-white/75">{editor.name}</p>}
      <fieldset disabled={working} className="grid min-w-0 gap-5 md:grid-cols-2">
        <div className="space-y-3 md:col-span-2">
          <label htmlFor={`${baseId}-imageUrl`} className="text-sm text-white/75">商品图片</label>
          <div className="max-w-xs"><PointShopProductImage imageUrl={editor.imageUrl} /></div>
          <input ref={imageInput} id={`${baseId}-imageUrl`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="sr-only" tabIndex={-1}
            onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void uploadImage(file); }} />
          <button type="button" className={button} disabled={working} onClick={() => imageInput.current?.click()}>{uploading ? '上传中…' : editor.imageUrl ? '更换图片' : '上传图片'}</button>
        </div>
        {!imageOnly && <>
        {field('name', '券名称', <input id={`${baseId}-name`} className={input} value={editor.name} required maxLength={100} disabled={legacy} onChange={(event) => change('name', event.target.value)} />)}
        {field('description', '券说明', <textarea id={`${baseId}-description`} className={input} value={editor.description} maxLength={1000} onChange={(event) => change('description', event.target.value)} />)}
        {!legacy && <>
          {field('kind', '券类型', <select id={`${baseId}-kind`} className={input} value={editor.kind} onChange={(event) => change('kind', event.target.value as Editor['kind'])}>
            <option value="ORDER_DISCOUNT">订单折扣券</option><option value="GIFT">指定礼物券</option>
          </select>)}
          {editor.kind === 'GIFT' && <>
            {field('giftName', '指定礼物', <select id={`${baseId}-giftName`} className={input} required value={editor.giftName} onChange={(event) => change('giftName', event.target.value)}>
              <option value="" />
              {[...new Set([...(data?.gifts ?? []), ...(editor.giftName ? [editor.giftName] : [])])].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>)}
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={editor.free} onChange={(event) => {
              change('free', event.target.checked);
              if (!event.target.checked && Number(editor.discount) <= 0) change('discount', '9');
            }} />免费兑换</label>
          </>}
          {(editor.kind === 'ORDER_DISCOUNT' || !editor.free) && numberField('discount', '折扣', '0.001', '0.001', '9.999')}
          {editor.kind === 'ORDER_DISCOUNT' && numberField('maxDiscountAmount', '最高优惠金额', '0.0001', '0.0001')}
        </>}
        {numberField('pointsCost', '兑换积分', '0.0001', '0.0001')}
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={editor.unlimited} onChange={(event) => change('unlimited', event.target.checked)} />不限量</label>
          {!editor.unlimited && numberField('stock', '库存', '0', '1', '2147483647')}
        </div>
        {numberField('couponExpireDays', '有效天数', '1', '1', '36500')}
        {numberField('sortOrder', '排序', '0', '1', '2147483647')}
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={editor.isActive} onChange={(event) => change('isActive', event.target.checked)} />上架</label>
        </>}
      </fieldset>
      <div className="flex gap-3"><button className={`${button} bg-violet-600/50`} type="submit" disabled={working}>{busy ? '保存中…' : '保存'}</button>
        <button className={button} type="button" disabled={working} onClick={() => setEditor(null)}>取消</button></div>
    </form>}

    {!data && !message && <div className="h-32 animate-pulse rounded-2xl bg-white/5" />}
    <div className="grid gap-4 md:grid-cols-2">
      {data?.items.map((item, index) => <article key={item.id} className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-5" aria-labelledby={`${baseId}-item-${index}`}>
        <PointShopProductImage imageUrl={item.imageUrl} />
        <div className="flex items-start justify-between gap-3"><h2 id={`${baseId}-item-${index}`} className="break-words text-lg font-semibold">{item.name}</h2>
          <span className={`shrink-0 text-sm ${item.isActive ? 'text-emerald-300' : 'text-white/50'}`}>{item.isActive ? '已上架' : '已下架'}</span></div>
        {item.description && <p className="whitespace-pre-wrap break-words text-sm text-white/65">{item.description}</p>}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-white/50">兑换积分</dt><dd>{item.pointsCost}</dd></div>
          <div><dt className="text-white/50">库存</dt><dd>{item.stock ?? '不限量'}</dd></div>
          {item.canEditVoucher && <div><dt className="text-white/50">有效天数</dt><dd>{item.couponExpireDays ?? 30}</dd></div>}
          <div><dt className="text-white/50">排序</dt><dd>{item.sortOrder}</dd></div>
          {item.voucherRule && <>
            <div><dt className="text-white/50">券类型</dt><dd>{item.voucherRule.kind === 'ORDER_DISCOUNT' ? '订单折扣券' : '指定礼物券'}</dd></div>
            {item.voucherRule.kind === 'GIFT' && <div><dt className="text-white/50">指定礼物</dt><dd>{item.voucherRule.giftName}</dd></div>}
            <div><dt className="text-white/50">折扣</dt><dd>{item.voucherRule.payRate === '0' ? '免费兑换' : displayDiscount(item.voucherRule.payRate)}</dd></div>
            {item.voucherRule.kind === 'ORDER_DISCOUNT' && <div><dt className="text-white/50">最高优惠金额</dt><dd>{item.voucherRule.maxDiscountAmount}</dd></div>}
          </>}
        </dl>
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={working} aria-describedby={`${baseId}-item-${index}`} onClick={() => { setEditor(openEditor(item)); setMessage(null); }}>编辑</button>
          {item.canEditVoucher && <button className={button} disabled={working} aria-describedby={`${baseId}-item-${index}`} onClick={() => void write({ action: 'toggle', id: item.id, expectedUpdatedAt: item.updatedAt, isActive: !item.isActive }, false, item.isActive ? '已下架' : '已上架')}>{item.isActive ? '下架' : '上架'}</button>}
        </div>
      </article>)}
    </div>
  </div>;
}
