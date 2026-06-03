import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { MediaAssetView } from '../MediaAssetView';
import { SectionLabel } from '../SectionLabel';

export function ExpoSection({ expo }: { expo: NewHomeContent['expo'] }) {
  return (
    <section id="expo" className={styles.section}>
      <div className={styles.sectionShell}>
        <SectionLabel number={expo.sectionNumber} title={expo.sectionTitle} />
        <p className={`${styles.sectionIntro} ${styles.reveal}`} data-reveal>
          {expo.intro}
        </p>
        <div className={styles.expoGrid}>
          <div>
            <div className={styles.metricGrid}>
              {expo.metrics.map((metric) => (
                <article key={metric.label} className={`${styles.metricCard} ${styles.reveal}`} data-reveal>
                  <span className={styles.metricValue}>{metric.value}</span>
                  <div className={styles.metricLabel}>{metric.label}</div>
                </article>
              ))}
            </div>

            <div className={styles.scheduleList}>
              {expo.schedule.map((item) => (
                <article key={item.title} className={`${styles.scheduleCard} ${styles.reveal}`} data-reveal>
                  <h3 className={styles.scheduleTitle}>{item.title}</h3>
                  <p className={styles.scheduleText}>{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.expoFeatureGrid}>
            {expo.featureCards.map((card) => (
              <article
                key={card.title}
                className={`${styles.expoCard} ${styles.interactiveSurface} ${styles.reveal}`}
                data-tilt
                data-reveal
              >
                <div className={styles.expoMedia}>
                  <MediaAssetView media={card.media} sizes="(max-width: 900px) 100vw, 28vw" />
                </div>
                <div className={styles.expoCopy}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardText}>{card.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
