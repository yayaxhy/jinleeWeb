import type { NewHomeContent } from '@/app/newhome/content';

import styles from '../NewHomePage.module.css';
import { SectionLabel } from '../SectionLabel';

export function QuoteSection({ quote }: { quote: NewHomeContent['quote'] }) {
  return (
    <section id="quote" className={styles.section}>
      <div className={styles.sectionShell}>
        <SectionLabel number="Q01" title="Quote" />
        <article className={`${styles.quotePanel} ${styles.reveal}`} data-reveal>
          <blockquote className={styles.quoteText}>{quote.text}</blockquote>
          <div className={styles.quoteMeta}>
            <span className={styles.quoteAuthor}>{quote.attribution}</span>
            <p className={styles.quoteSupport}>{quote.supportingText}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
