'use client';

import { useMemo, useState } from 'react';

type Props = {
  title: string;
  description: string;
  endpoint: string;
  notes?: string[];
  accept?: string;
  maxFiles?: number;
  actionLabel?: string;
};

type UploadResponse = {
  saved?: string[];
  error?: string;
};

export function PeiwanCardUploader({
  title,
  description,
  endpoint,
  notes,
  accept = 'image/*',
  maxFiles,
  actionLabel = '开始上传',
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const fileSummary = useMemo(() => {
    if (files.length === 0) return '未选择文件';
    const names = files.map((file) => file.name).join(', ');
    return `${files.length} 个文件：${names}`;
  }, [files]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    setFiles(list);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('请先选择要上传的文件');
      return;
    }
    if (maxFiles && files.length > maxFiles) {
      setError(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json().catch(() => ({}))) as UploadResponse;
      if (!response.ok) {
        throw new Error(data.error ?? '上传失败，请稍后再试');
      }

      const savedNames = data.saved ?? [];
      setSuccess(`已成功上传 ${savedNames.length || files.length} 个文件${savedNames.length ? `：${savedNames.join(', ')}` : ''}`);
      setFiles([]);
      setInputKey((prev) => prev + 1);
    } catch (err: any) {
      setError(err.message ?? '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/70">{description}</p>
      </div>

      {notes && notes.length > 0 ? (
        <ul className="space-y-1 text-sm text-white/60 list-disc list-inside">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3">
        <label className="block text-sm text-white/80">选择文件</label>
        <input
          key={inputKey}
          type="file"
          multiple
          accept={accept}
          className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#5c43a3] file:px-4 file:py-2 file:text-white hover:border-white/20"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <p className="text-xs text-white/60">{fileSummary}</p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="w-full rounded-full bg-[#5c43a3] px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388] disabled:opacity-60"
        >
          {uploading ? '上传中…' : actionLabel}
        </button>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
      </div>
    </div>
  );
}
