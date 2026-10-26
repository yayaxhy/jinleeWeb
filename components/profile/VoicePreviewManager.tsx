'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { PublicMessageError, publicMessage } from '@/lib/public-error-messages';

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

const resolvePreviewSrc = (rawUrl: string | null) => {
  const value = String(rawUrl ?? '').trim();
  if (!value) return null;
  return `/api/profile/voice-preview?v=${encodeURIComponent(value)}`;
};

const deriveFriendlyFilename = (filename: string | null, url: string | null) => {
  const rawFilename = String(filename ?? '').trim();
  if (rawFilename && !/^voice_\d+_[a-f0-9]{12}\.[a-z0-9]+$/i.test(rawFilename)) {
    return rawFilename;
  }
  const value = String(url ?? '').trim();
  if (!value) return rawFilename;
  try {
    const parsed = new URL(value);
    return parsed.pathname.split('/').pop() || rawFilename;
  } catch {
    return value.split('/').pop() || rawFilename;
  }
};

export function VoicePreviewManager({ initialUrl, initialFilename }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const previewSrc = resolvePreviewSrc(initialUrl);
  const displayFilename = deriveFriendlyFilename(initialFilename, initialUrl);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setNotice(null);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setNotice({ level: 'info', text: siteCopy("site.components.profile.voicepreviewmanager.1b5fe8dffa8c") });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setNotice({ level: 'error', text: siteCopy("site.components.profile.voicepreviewmanager.7de1fabb79b4") });
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
          throw new PublicMessageError(typeof data?.error === 'string' ? data.error : '上传失败');
        }
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = '';
        setNotice({ level: 'success', text: siteCopy("site.components.profile.voicepreviewmanager.5c56955a5191") });
        router.refresh();
      } catch (error) {
        setNotice({
          level: 'error',
          text: publicMessage(error, '上传失败，请稍后再试'),
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
        throw new PublicMessageError(typeof data?.error === 'string' ? data.error : '删除失败');
      }
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setNotice({ level: 'success', text: siteCopy("site.components.profile.voicepreviewmanager.6929e31e50c0") });
      router.refresh();
    } catch (error) {
      setNotice({
        level: 'error',
        text: publicMessage(error, '删除失败，请稍后再试'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.components.profile.voicepreviewmanager.becd1c33a95f" /></h3>
          <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.voicepreviewmanager.551c32c1a83f" /></p>
        </div>
      </div>

      <div className="mt-4 space-y-4 rounded-3xl border border-black/5 bg-[#faf7f2] p-4">
        {notice ? (
          <NoticeBanner level={notice.level} message={siteCopy.text(notice.text, "site.components.profile.voicepreviewmanager")} onDismiss={() => setNotice(null)} />
        ) : null}

        <div className="rounded-2xl border border-dashed border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.voicepreviewmanager.df61d8d5c5f6" /></p>
            <p className="text-xs text-gray-500"><SiteText namespace="site.components.profile.voicepreviewmanager" value={SUPPORTED_TYPES_TEXT} /></p>
          </div>

          {previewSrc ? (
            <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <audio controls preload="metadata" className="w-full" src={previewSrc}><SiteText copyKey="site.components.profile.voicepreviewmanager.6414cdb2f0ee" /></audio>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-xs text-gray-500"><SiteText copyKey="site.components.profile.voicepreviewmanager.1a11c2910390" />{displayFilename || <SiteText copyKey="site.components.profile.voicepreviewmanager.23d736fa86c8" />}
                </p>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting || isUploading}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? <SiteText copyKey="site.components.profile.voicepreviewmanager.60793243146e" /> : <SiteText copyKey="site.components.profile.voicepreviewmanager.4ccbfde078dc" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-5 text-sm text-gray-500"><SiteText copyKey="site.components.profile.voicepreviewmanager.a23b0a713f88" /></div>
          )}

          <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.voicepreviewmanager.1f653dc91b3c" /></span>
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
                {selectedFile ? <SiteText copyKey="site.components.profile.voicepreviewmanager.7435e4045617" values={{value1: String(selectedFile.name)}} /> : <SiteText copyKey="site.components.profile.voicepreviewmanager.10ef6e55884e" />}
              </p>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || isDeleting}
                className="rounded-full border border-[#e7c56c] bg-[linear-gradient(180deg,_#fff4cc,_#f8df97)] px-5 py-3 text-sm font-semibold text-[#8a6000] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? <SiteText copyKey="site.components.profile.voicepreviewmanager.670f6d264ca0" /> : <SiteText copyKey="site.components.profile.voicepreviewmanager.f80a2b85f3bd" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
