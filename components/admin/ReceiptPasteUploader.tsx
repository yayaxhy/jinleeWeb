"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useRef,
  useState,
} from "react";

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type Props = {
  name?: string;
};

export function ReceiptPasteUploader({ name = "receipt" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const selectFile = (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setMessage("只支持 PNG、JPG 或 WebP 图片。");
      return;
    }

    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    setMessage(`已选择：${file.name || "剪贴板截图"}`);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(event.clipboardData.items).find((candidate) =>
      ACCEPTED_IMAGE_TYPES.has(candidate.type),
    );
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    selectFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0] ?? null);
  };

  return (
    <div
      tabIndex={0}
      onPaste={handlePaste}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="rounded-xl border border-dashed border-white/20 bg-black/15 px-3 py-2 outline-none transition focus:border-[#a78bfa]/70"
      aria-label="转账截图上传区，可粘贴截图"
    >
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="block w-full text-xs text-white/70"
      />
      <p className="mt-1 text-xs leading-5 text-white/45">
        点击此区域后按 Ctrl/Cmd + V 粘贴截图，也可拖入或选择文件。
      </p>
      {message ? (
        <p className="mt-1 text-xs text-[#c4b5fd]">{message}</p>
      ) : null}
    </div>
  );
}
