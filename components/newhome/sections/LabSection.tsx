import Image from 'next/image';

import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { SectionLabel } from '../SectionLabel';

export function LabSection({ lab }: { lab: NewHomeContent['lab'] }) {
  return (
    <section id="bananas" className={styles.section}>
      <div className={styles.sectionShell}>
        <SectionLabel number={lab.sectionNumber} title={lab.sectionTitle} />
        <div className={styles.labGrid}>
          <article className={`${styles.labPanel} ${styles.reveal}`} data-reveal>
            <div className={styles.labPoster}>
              <Image
                src={lab.poster}
                alt="Pop art mouth poster"
                fill
                className={styles.mediaImage}
                sizes="(max-width: 1120px) 100vw, 44vw"
                unoptimized
              />
            </div>
          </article>

          <article className={`${styles.labPanel} ${styles.reveal}`} data-reveal>
            <div className={styles.labInner}>
              <Image src={lab.sticker} alt="Cow sticker" width={248} height={248} className={styles.sticker} unoptimized />
              <Image
                src={lab.colaVisual}
                alt="Cola bottle illustration"
                width={210}
                height={210}
                className={styles.stickerSecondary}
                unoptimized
              />
              <Image src={lab.paints[0]} alt="" width={96} height={96} className={styles.paintA} unoptimized />
              <Image src={lab.paints[1]} alt="" width={112} height={112} className={styles.paintB} unoptimized />
              <Image src={lab.paints[2]} alt="" width={88} height={88} className={styles.paintC} unoptimized />
              <h3 className={styles.labHeading}>{lab.heading}</h3>
              <p className={styles.heroText}>{lab.text}</p>
              <div className={styles.chipRow}>
                {lab.chips.map((chip) => (
                  <span key={chip} className={styles.chip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
