import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { MediaAssetView } from '../MediaAssetView';
import { SectionLabel } from '../SectionLabel';

export function SpotlightSection({
  spotlight,
  storyCards,
}: {
  spotlight: NewHomeContent['spotlight'];
  storyCards: NewHomeContent['storyCards'];
}) {
  return (
    <section id="elvis" className={styles.section}>
      <div className={styles.sectionShell}>
        <SectionLabel number={spotlight.sectionNumber} title={spotlight.sectionTitle} />
        <div className={styles.splitGrid}>
          <article className={`${styles.contentPanel} ${styles.reveal}`} data-reveal>
            <div className={styles.panelMedia}>
              <MediaAssetView media={spotlight.feature} sizes="(max-width: 1120px) 100vw, 44vw" priority />
            </div>
            <div className={styles.panelBody}>
              <span className={styles.kicker}>{spotlight.kicker}</span>
              <h3 className={styles.panelHeading}>{spotlight.heading}</h3>
              <p className={styles.storyBody}>{spotlight.body}</p>
              <ul className={styles.bulletList}>
                {spotlight.points.map((point) => (
                  <li key={point} className={styles.bulletItem}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <div className={styles.storyCardGrid}>
            {storyCards.map((card) => (
              <article
                key={card.title}
                className={`${styles.storyCard} ${styles.interactiveSurface} ${styles.reveal}`}
                data-tilt
                data-reveal
              >
                <div className={styles.storyMedia}>
                  <MediaAssetView media={card.media} sizes="(max-width: 1120px) 100vw, 28vw" />
                </div>
                <div className={styles.storyCopy}>
                  <div className={styles.cardEyebrow}>{card.eyebrow}</div>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardText}>{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
