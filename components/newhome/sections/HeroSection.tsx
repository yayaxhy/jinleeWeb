import Image from 'next/image';

import type { NewHomeContent, Tone } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { MediaAssetView } from '../MediaAssetView';

const toneClassName: Record<Tone, string> = {
  red: styles.toneRed,
  gold: styles.toneGold,
  ink: styles.toneInk,
  olive: styles.toneOlive,
};

export function HeroSection({
  hero,
  heroCards,
}: {
  hero: NewHomeContent['hero'];
  heroCards: NewHomeContent['heroCards'];
}) {
  return (
    <section id="hero" className={`${styles.section} ${styles.hero}`}>
      <div className={`${styles.sectionShell} ${styles.heroGrid}`}>
        <div className={`${styles.heroCopy} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>{hero.eyebrow}</div>
          <h1 className={styles.heroTitle}>{hero.title}</h1>
          <p className={styles.heroText}>{hero.description}</p>
          <div className={styles.heroActions}>
            <a href={hero.primaryCta.href} className={styles.buttonPrimary}>
              {hero.primaryCta.label}
            </a>
            <a href={hero.secondaryCta.href} className={styles.buttonGhost}>
              {hero.secondaryCta.label}
            </a>
          </div>
          <ul className={styles.statList}>
            {hero.stats.map((stat) => (
              <li key={stat.label} className={`${styles.statCard} ${styles.reveal}`} data-reveal>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${styles.heroArt} ${styles.reveal}`} data-reveal>
          <div
            className={styles.heroBackdrop}
            style={{ backgroundImage: `url(${hero.background})` }}
            data-parallax
          />
          <Image
            src={hero.logo}
            alt="WarholArts logo"
            width={132}
            height={44}
            className={styles.heroLogo}
            unoptimized
          />
          <div className={styles.wordGrid}>
            {heroCards.map((card) => (
              <article
                key={card.letter}
                className={`${styles.heroCard} ${styles.interactiveSurface} ${toneClassName[card.tone]}`}
                data-tilt
                data-reveal
              >
                <div className={styles.heroCardMedia}>
                  <MediaAssetView media={card.media} sizes="(max-width: 900px) 100vw, 30vw" />
                </div>
                <div className={styles.heroCardContent}>
                  <span className={styles.heroLetter}>{card.letter}</span>
                  <div>
                    <h2 className={styles.heroCardTitle}>{card.title}</h2>
                    <p className={styles.heroCardText}>{card.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
