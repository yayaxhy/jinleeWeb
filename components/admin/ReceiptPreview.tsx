"use client";

import { useEffect, useState } from "react";

type ReceiptPreviewProps = {
  evidenceId: string;
  originalFileName?: string;
  variant?: "thumbnail" | "link";
};

export function ReceiptPreview({
  evidenceId,
  originalFileName = "转账截图",
  variant = "thumbnail",
}: ReceiptPreviewProps) {
  const [open, setOpen] = useState(false);
  const source = `/api/admin/cash-reconciliation/evidence/${evidenceId}`;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="点击在当前页面放大查看转账截图"
        className={
          variant === "thumbnail"
            ? "block overflow-hidden rounded-lg border border-white/15 bg-black/30 transition hover:border-[#c4b5fd]/70"
            : "text-left text-xs text-[#c4b5fd] underline"
        }
      >
        {variant === "thumbnail" ? (
          <img
            src={source}
            alt={originalFileName}
            className="h-14 w-14 object-cover"
          />
        ) : (
          "查看截图"
        )}
      </button>

      {open ? (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed top-5 right-5 z-10 rounded-full border border-white/25 bg-black/70 px-3 py-1.5 text-xs text-white hover:bg-black"
          >
            关闭预览
          </button>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="转账截图预览"
            onClick={(event) => event.stopPropagation()}
            className="mx-auto min-h-full w-full rounded-2xl border border-white/20 bg-[#0a0a0f] p-3 shadow-2xl"
          >
            <img
              src={source}
              alt={originalFileName}
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
