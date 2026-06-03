import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { MediaAssetView } from '../MediaAssetView';
import { SectionLabel } from '../SectionLabel';

export function TicketsSection({
  tickets,
  ticketTiers,
}: {
  tickets: NewHomeContent['tickets'];
  ticketTiers: NewHomeContent['ticketTiers'];
}) {
  return (
    <section id="tickets" className={styles.section}>
      <div className={styles.sectionShell}>
        <SectionLabel number={tickets.sectionNumber} title={tickets.sectionTitle} />
        <p className={`${styles.sectionIntro} ${styles.reveal}`} data-reveal>
          {tickets.intro}
        </p>
        <div className={styles.ticketGrid}>
          {ticketTiers.map((tier) => (
            <article
              key={tier.name}
              className={`${styles.ticketCard} ${styles.interactiveSurface} ${styles.reveal}`}
              data-tilt
              data-reveal
            >
              <div className={styles.ticketMedia}>
                <MediaAssetView media={tier.media} sizes="(max-width: 900px) 100vw, 32vw" />
              </div>
              <div className={styles.ticketCopy}>
                <h3 className={styles.cardTitle}>{tier.name}</h3>
                <div className={styles.ticketAudience}>{tier.audience}</div>
                <span className={styles.ticketPrice}>{tier.price}</span>
                <p className={styles.ticketNote}>{tier.note}</p>
                <ul className={styles.featureList}>
                  {tier.features.map((feature) => (
                    <li key={feature} className={styles.featureItem}>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
