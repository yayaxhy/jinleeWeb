'use client';

import { useState } from 'react';

export function PointShopProductImage({ imageUrl, className = '' }: {
  imageUrl: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={`flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-[#f8f5ef] ${className}`} aria-hidden="true">
    {imageUrl && failedUrl !== imageUrl ? (
      // Uploaded images use the existing immutable local image service.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-3"
        onError={() => setFailedUrl(imageUrl)} />
    ) : (
      <svg viewBox="0 0 80 64" fill="none" className="h-16 w-20 text-[#c5b795]">
        <path d="M12 15a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v10a7 7 0 0 0 0 14v10a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V39a7 7 0 0 0 0-14V15Z" stroke="currentColor" strokeWidth="2" />
        <path d="M51 15v34M26 25l12 14M38 25 26 39" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5" />
      </svg>
    )}
  </div>;
}
