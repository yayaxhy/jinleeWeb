import styles from './NewHomePage.module.css';

export function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className={styles.sectionLabel} data-reveal>
      <span className={styles.sectionNumber}>{number}</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
  );
}
