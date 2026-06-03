import Image from 'next/image';

import type { MediaAsset } from '@/app/newhome/content';

import styles from './NewHomePage.module.css';

export function MediaAssetView({
  media,
  sizes,
  priority = false,
}: {
  media: MediaAsset;
  sizes: string;
  priority?: boolean;
}) {
  if (media.type === 'video') {
    return (
      <video
        className={styles.mediaVideo}
        autoPlay
        loop
        muted
        playsInline
        poster={media.poster}
        aria-label={media.alt}
      >
        {media.webm ? <source src={media.webm} type="video/webm" /> : null}
        <source src={media.mp4} type="video/mp4" />
      </video>
    );
  }

  return (
    <Image
      src={media.src}
      alt={media.alt}
      fill
      className={styles.mediaImage}
      sizes={sizes}
      priority={priority}
      unoptimized
    />
  );
}
