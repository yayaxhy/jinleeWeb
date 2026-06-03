import Image from 'next/image';

import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';

export function CtaSection({
  cta,
  poster,
}: {
  cta: NewHomeContent['cta'];
  poster: string;
}) {
  return (
    <section id="mirror" className={styles.section}>
      <div className={styles.sectionShell}>
        <article className={`${styles.ctaPanel} ${styles.reveal}`} data-reveal>
          <div className={styles.ctaGrid}>
            <div className={styles.ctaMedia}>
              <Image
                src={poster}
                alt="Pop art lips graphic"
                fill
                className={styles.mediaImage}
                sizes="(max-width: 1120px) 100vw, 42vw"
                unoptimized
              />
            </div>
            <div className={styles.ctaBody}>
              <div className={styles.eyebrow}>Editable structure</div>
              <h2 className={styles.ctaHeading}>{cta.heading}</h2>
              <p className={styles.ctaText}>{cta.text}</p>
              <a href={cta.action.href} className={styles.buttonPrimary}>
                {cta.action.label}
              </a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
