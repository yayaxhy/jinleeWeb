import Link from 'next/link';

import type { NewHome404Content, NewHomeContent } from '@/app/newhome/content';

import styles from './NewHomePage.module.css';
import { MediaAssetView } from './MediaAssetView';
import { NewHomeEffects } from './NewHomeEffects';
import { NewHomeHeader } from './NewHomeHeader';
import { CtaSection } from './sections/CtaSection';
import { ExpoSection } from './sections/ExpoSection';
import { GallerySection } from './sections/GallerySection';
import { HeroSection } from './sections/HeroSection';
import { LabSection } from './sections/LabSection';
import { QuoteSection } from './sections/QuoteSection';
import { SpotlightSection } from './sections/SpotlightSection';
import { TicketsSection } from './sections/TicketsSection';

export function NewHomePage({ content }: { content: NewHomeContent }) {
  return (
    <div className={styles.page}>
      <NewHomeEffects />
      <NewHomeHeader navItems={content.navItems} />

      <main>
        <HeroSection hero={content.hero} heroCards={content.heroCards} />
        <SpotlightSection spotlight={content.spotlight} storyCards={content.storyCards} />
        <QuoteSection quote={content.quote} />
        <GallerySection gallery={content.gallery} galleryCards={content.galleryCards} />
        <LabSection lab={content.lab} />
        <ExpoSection expo={content.expo} />
        <TicketsSection tickets={content.tickets} ticketTiers={content.ticketTiers} />
        <CtaSection cta={content.cta} poster={content.lab.poster} />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerText}>{content.footer.caption}</p>
          <div className={styles.footerLinks}>
            {content.footer.links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={styles.footerLink}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function NewHome404Page({ content }: { content: NewHome404Content }) {
  return (
    <div className={`${styles.page} ${styles.notFoundPage}`}>
      <NewHomeEffects />
      <NewHomeHeader
        navItems={[{ label: 'Back Home', href: '#not-found' }]}
        utilityHref={content.homeHref}
        utilityLabel={content.homeLabel}
      />

      <main className={styles.notFoundSection}>
        <div className={styles.sectionShell}>
          <article className={`${styles.notFoundPanel} ${styles.reveal}`} data-reveal>
            <div className={styles.notFoundGrid} id="not-found">
              <div className={styles.notFoundMedia}>
                <MediaAssetView media={content.media} sizes="(max-width: 1120px) 100vw, 42vw" priority />
              </div>
              <div className={styles.notFoundBody}>
                <div className={styles.notFoundCode}>404 / local route</div>
                <h1 className={styles.notFoundTitle}>{content.title}</h1>
                <p className={styles.notFoundText}>{content.text}</p>
                <Link href={content.homeHref} className={styles.buttonPrimary} prefetch={false}>
                  {content.homeLabel}
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
