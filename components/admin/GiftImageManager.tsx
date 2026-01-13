'use client';

import { useMemo, useState } from 'react';

type GiftItem = {
  name: string;
  imageUrl: string | null;
};

type UploadResponse = {
  ok?: boolean;
  imageUrl?: string;
  error?: string;
};

type Props = {
  initialGifts: GiftItem[];
  endpoint: string;
};

export function GiftImageManager({ initialGifts, endpoint }: Props) {
  const [gifts, setGifts] = useState<GiftItem[]>(initialGifts);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, number>>({});

  const giftMap = useMemo(() => new Map(gifts.map((gift) => [gift.name, gift])), [gifts]);

  const handleFileChange = (giftName: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [giftName]: file }));
    setMessages((prev) => ({ ...prev, [giftName]: '' }));
  };

  const handleUpload = async (giftName: string) => {
    const file = files[giftName];
    if (!file) {
      setMessages((prev) => ({ ...prev, [giftName]: '请先选择图片文件' }));
      return;
    }

    setUploading((prev) => ({ ...prev, [giftName]: true }));
    setMessages((prev) => ({ ...prev, [giftName]: '' }));

    try {
      const formData = new FormData();
      formData.append('giftName', giftName);
      formData.append('file', file);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as UploadResponse;
      if (!response.ok) {
        throw new Error(data.error ?? '上传失败');
      }

      if (data.imageUrl) {
        setGifts((prev) =>
          prev.map((gift) =>
            gift.name === giftName ? { ...gift, imageUrl: data.imageUrl ?? null } : gift
          )
        );
      }

      setFiles((prev) => ({ ...prev, [giftName]: null }));
      setInputKeys((prev) => ({ ...prev, [giftName]: (prev[giftName] ?? 0) + 1 }));
      setMessages((prev) => ({ ...prev, [giftName]: '上传成功' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传失败';
      setMessages((prev) => ({ ...prev, [giftName]: message }));
    } finally {
      setUploading((prev) => ({ ...prev, [giftName]: false }));
    }
  };

  if (gifts.length === 0) {
    return <p className="text-sm text-white/60">暂无礼物配置。</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {gifts.map((gift) => {
        const status = messages[gift.name];
        const isUploading = uploading[gift.name];
        const inputKey = inputKeys[gift.name] ?? 0;
        const current = giftMap.get(gift.name);

        return (
          <div key={gift.name} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                {current?.imageUrl ? (
                  <img
                    src={current.imageUrl}
                    alt={gift.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-white/40">
                    暂无图片
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">礼物</p>
                <p className="text-lg font-semibold text-white">{gift.name}</p>
                <p className="text-xs text-white/50 break-all">{current?.imageUrl ?? '未设置'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <input
                key={inputKey}
                type="file"
                accept="image/*"
                className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#5c43a3] file:px-3 file:py-1 file:text-white hover:border-white/20"
                onChange={(event) => handleFileChange(gift.name, event.target.files?.[0] ?? null)}
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => handleUpload(gift.name)}
                disabled={isUploading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#5c43a3] px-4 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-[#4a3388] disabled:opacity-60"
              >
                {isUploading ? '上传中…' : '上传图片'}
              </button>
              {status ? (
                <p className={`text-xs ${status === '上传成功' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {status}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
