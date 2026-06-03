'use client';

import { useState } from 'react';

type Props = {
  initialRaw: string;
  defaultRaw: string;
  contentPath: string;
};

export function NewHomeContentManager({ initialRaw, defaultRaw, contentPath }: Props) {
  const [raw, setRaw] = useState(initialRaw);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const formatCurrent = () => {
    try {
      const formatted = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
      setRaw(formatted);
      setMessage('已格式化 JSON');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'JSON 格式错误';
      setMessage(`格式化失败：${text}`);
    }
  };

  const resetToDefault = () => {
    setRaw(defaultRaw);
    setMessage('已恢复到默认内容，点击保存后才会落盘。');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/newhome-content', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? '保存失败');
      }

      setRaw(`${JSON.stringify(JSON.parse(raw), null, 2)}\n`);
      setMessage('保存成功，/newhome-editable 刷新后会读取最新内容。');
    } catch (error) {
      const text = error instanceof Error ? error.message : '保存失败';
      setMessage(text);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <p className="text-sm text-white/70">
          当前内容文件：
          <span className="ml-2 rounded bg-white/10 px-2 py-1 font-mono text-xs">{contentPath}</span>
        </p>
        <p className="text-sm text-white/50">
          这是可编辑版页面的原始 JSON 编辑入口。你可以直接改文案、图片路径、票种、区块数组，然后保存。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={formatCurrent}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          格式化 JSON
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          恢复默认
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-[#c5512f] px-4 py-2 text-sm text-white hover:bg-[#af4527] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? '保存中…' : '保存到后台'}
        </button>
        <a
          href="/newhome-editable"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          预览 /newhome-editable
        </a>
        <a
          href="/newhome-editable/404"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          预览 /newhome-editable/404
        </a>
        <a
          href="/newhome"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          对照原版 /newhome
        </a>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
          className="min-h-[720px] w-full resize-y bg-transparent px-5 py-4 font-mono text-xs leading-6 text-white outline-none"
        />
      </div>

      {message ? <p className="text-sm text-white/70">{message}</p> : null}
    </div>
  );
}
