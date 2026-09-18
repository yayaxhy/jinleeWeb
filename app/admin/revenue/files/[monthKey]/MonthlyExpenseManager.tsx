'use client';

import { type ChangeEvent, type ClipboardEvent, type FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ManualExpenseRecord = {
  id: string;
  monthKey: string;
  amount: string;
  note: string;
  hasImage: boolean;
  operatorId: string;
  operatorName: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  monthKey: string;
  records: ManualExpenseRecord[];
};

const formatMoney = (value: string) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(Number(value));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));

export default function MonthlyExpenseManager({ monthKey, records }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setSelectedImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('请粘贴或选择图片文件。');
      return;
    }
    setImage(file);
    setMessage(`已选择图片：${file.name || '剪贴板图片'}`);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedImage(event.target.files?.[0] ?? null);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    const file = imageItem?.getAsFile();
    if (!file) return;
    event.preventDefault();
    setSelectedImage(file);
  };

  const startEdit = (record: ManualExpenseRecord) => {
    setEditingId(record.id);
    setAmount(record.amount);
    setNote(record.note);
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setMessage('修改后点击保存，操作人和最后操作时间会更新为当前登录账号。');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('正在保存…');
    const formData = new FormData();
    formData.set('monthKey', monthKey);
    formData.set('amount', amount);
    formData.set('note', note);
    if (image) formData.set('image', image);

    try {
      const endpoint = editingId
        ? `/api/admin/revenue/files/manual-expenses/${encodeURIComponent(editingId)}`
        : '/api/admin/revenue/files/manual-expenses';
      const response = await fetch(endpoint, {
        method: editingId ? 'PATCH' : 'POST',
        body: formData,
      });
      const result = (await response.json()) as { error?: string; reportSynced?: boolean };
      if (!response.ok) throw new Error(result.error || '保存失败');
      resetForm();
      setMessage(result.reportSynced === false ? '已保存，但自动重新生成报表失败；请稍后使用“重新生成文件”。' : '已保存，并已同步更新本月报表。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const editingRecord = editingId ? records.find((record) => record.id === editingId) : null;

  return (
    <section className="space-y-5 rounded-3xl border border-amber-200/20 bg-amber-100/5 p-5">
      <div>
        <h3 className="text-lg font-semibold text-white">人工支出明细</h3>
        <p className="mt-1 text-sm text-white/60">可填写金额、备注和凭证图片。保存或修改时，系统会自动记录当前操作人和时间。</p>
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-white/70">金额</span>
          <input
            required
            min="0.0001"
            step="0.0001"
            inputMode="decimal"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="例如 5000"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <div
          tabIndex={0}
          onPaste={handlePaste}
          className="space-y-2 rounded-xl border border-dashed border-white/25 px-3 py-2 text-sm outline-none focus:border-amber-200"
          aria-label="支出凭证图片，可粘贴图片"
        >
          <span className="block text-white/70">凭证图片（可选）</span>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} className="block w-full text-xs text-white/70" />
          <p className="text-xs text-white/45">点击这里后可直接粘贴截图，支持 PNG、JPG、WebP、GIF，最大 10MB。</p>
          {image ? <p className="text-xs text-amber-100">待上传：{image.name || '剪贴板图片'}</p> : null}
          {!image && editingRecord?.hasImage ? <p className="text-xs text-white/50">未选择新图片时，会保留原凭证。</p> : null}
        </div>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="text-white/70">备注</span>
          <textarea
            required
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：广告"
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button type="submit" disabled={saving} className="rounded-full bg-amber-100 px-5 py-2 text-sm text-black hover:bg-white disabled:cursor-wait disabled:opacity-60">
            {saving ? '保存中…' : editingId ? '保存修改' : '保存支出'}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10">
              取消修改
            </button>
          ) : null}
          {message ? <p className="text-sm text-white/70">{message}</p> : null}
        </div>
      </form>

      {records.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/60">
                <th className="py-3 pr-4">金额</th>
                <th className="py-3 pr-4">备注</th>
                <th className="py-3 pr-4">图片</th>
                <th className="py-3 pr-4">操作人</th>
                <th className="py-3 pr-4">最后操作时间</th>
                <th className="py-3 pr-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-white/10 last:border-0">
                  <td className="py-3 pr-4 font-mono text-white">{formatMoney(record.amount)}</td>
                  <td className="max-w-sm py-3 pr-4 text-white/80">{record.note}</td>
                  <td className="py-3 pr-4">
                    {record.hasImage ? (
                      <a
                        href={`/api/admin/revenue/files/manual-expenses/${encodeURIComponent(record.id)}/image`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-100 underline underline-offset-2 hover:text-white"
                      >
                        查看凭证
                      </a>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="text-white/90">{record.operatorName}</div>
                    <div className="font-mono text-xs text-white/45">{record.operatorId}</div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-white/70">{formatDate(record.updatedAt)}</td>
                  <td className="py-3 pr-4">
                    <button type="button" onClick={() => startEdit(record)} className="rounded-full border border-white/25 px-4 py-1.5 text-xs text-white hover:bg-white/10">
                      修改
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-white/55">本月还没有人工支出记录。</p>
      )}
    </section>
  );
}
