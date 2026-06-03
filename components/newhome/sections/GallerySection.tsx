import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { MediaAssetView } from '../MediaAssetView';
import { SectionLabel } from '../SectionLabel';

export function GallerySection({
  gallery,
  galleryCards,
}: {
  gallery: NewHomeContent['gallery'];
  galleryCards: NewHomeContent['galleryCards'];
}) {
  return (
    <section id="monroe" className={styles.section}>
      <div className={styles.sectionShell}>
        <SectionLabel number={gallery.sectionNumber} title={gallery.sectionTitle} />
        <p className={`${styles.sectionIntro} ${styles.reveal}`} data-reveal>
          {gallery.intro}
        </p>
        <div className={styles.galleryGrid}>
          {galleryCards.map((card) => (
            <article
              key={card.title}
              className={`${styles.galleryCard} ${styles.interactiveSurface} ${styles.reveal}`}
              data-tilt
              data-reveal
            >
              <div className={styles.galleryMedia}>
                <MediaAssetView media={card.media} sizes="(max-width: 900px) 100vw, 32vw" />
              </div>
              <div className={styles.galleryCopy}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardText}>{card.caption}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
