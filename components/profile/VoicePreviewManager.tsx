'use client';

import { ChangeEvent, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NoticeBanner } from './NoticeBanner';

type Props = {
  initialUrl: string | null;
  initialFilename: string | null;
};

type Notice = {
  level: 'success' | 'error' | 'info';
  text: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_TYPES_TEXT = '支持 mp3、m4a、wav、ogg、opus、webm、flac、aac，大小不超过 10MB。';

export function VoicePreviewManager({ initialUrl, initialFilename }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setNotice(null);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setNotice({ level: 'info', text: '请先选择一段试音音频。' });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setNotice({ level: 'error', text: '试音文件不能超过 10MB。' });
      return;
    }

    startUpload(async () => {
      setNotice(null);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await fetch('/api/profile/voice-preview', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : '上传失败');
        }
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = '';
        setNotice({ level: 'success', text: '试音已保存，之后老板收到你的名片时会看到这段音频。' });
        router.refresh();
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : '上传失败，请稍后再试',
        });
      }
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/profile/voice-preview', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '删除失败');
      }
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setNotice({ level: 'success', text: '已删除当前试音。' });
      router.refresh();
    } catch (error) {
      setNotice({
        level: 'error',
        text: error instanceof Error ? error.message : '删除失败，请稍后再试',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-wide text-[#8a6000]">试音管理</h3>
          <p className="text-sm text-gray-500">上传一段代表音频，机器人在派单名片里会一起发给老板。</p>
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gray-400">VOICE PREVIEW</span>
      </div>

      <div className="mt-4 space-y-4 rounded-3xl border border-black/5 bg-[#faf7f2] p-4">
        {notice ? (
          <NoticeBanner level={notice.level} message={notice.text} onDismiss={() => setNotice(null)} />
        ) : null}

        <div className="rounded-2xl border border-dashed border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#171717]">当前试音</p>
            <p className="text-xs text-gray-500">{SUPPORTED_TYPES_TEXT}</p>
          </div>

          {initialUrl ? (
            <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <audio controls preload="none" className="w-full">
                <source src={initialUrl} />
                你的浏览器暂不支持音频播放。
              </audio>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-xs text-gray-500">
                  当前文件：{initialFilename ?? initialUrl}
                </p>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting || isUploading}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? '删除中…' : '删除试音'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-5 text-sm text-gray-500">
              暂未上传试音。
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#171717]">上传新试音</span>
              <input
                ref={inputRef}
                type="file"
                accept="audio/aac,audio/flac,audio/m4a,audio/mp3,audio/mp4,audio/mpeg,audio/ogg,audio/opus,audio/wav,audio/webm,.aac,.flac,.m4a,.mp3,.ogg,.opus,.wav,.webm"
                onChange={handleFileChange}
                disabled={isUploading || isDeleting}
                className="block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#171717] file:mr-4 file:rounded-full file:border-0 file:bg-[#fff4cc] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#8a6000] hover:file:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-xs text-gray-500">
                {selectedFile ? `待上传：${selectedFile.name}` : '选择后会覆盖当前试音。'}
              </p>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || isDeleting}
                className="rounded-full border border-[#e7c56c] bg-[linear-gradient(180deg,_#fff4cc,_#f8df97)] px-5 py-3 text-sm font-semibold text-[#8a6000] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? '上传中…' : '保存试音'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
