'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { NavItem } from '@/app/newhome/content';

import styles from './NewHomePage.module.css';

export function NewHomeHeader({
  navItems,
  utilityHref = '/newhome/404',
  utilityLabel = '404 Room',
}: {
  navItems: NavItem[];
  utilityHref?: string;
  utilityLabel?: string;
}) {
  const [activeHref, setActiveHref] = useState(navItems[0]?.href ?? '#hero');

  useEffect(() => {
    const sections = navItems
      .map((item) => document.querySelector<HTMLElement>(item.href))
      .filter((section): section is HTMLElement => !!section);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visible?.target.id) {
          return;
        }

        setActiveHref(`#${visible.target.id}`);
      },
      {
        rootMargin: '-25% 0px -45% 0px',
        threshold: [0.2, 0.35, 0.5, 0.7],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [navItems]);

  const handleJump = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href.startsWith('#')) {
      return;
    }

    const target = document.querySelector<HTMLElement>(href);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', href);
  };

  return (
    <header className={styles.header}>
      <Link href="/newhome" className={styles.brand} prefetch={false}>
        <span className={styles.brandMark}>WarholArts</span>
        <span className={styles.brandMeta}>Next.js Edition</span>
      </Link>
      <nav className={styles.nav} aria-label="Newhome sections">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={handleJump(item.href)}
            className={styles.navLink}
            data-active={activeHref === item.href ? 'true' : 'false'}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <Link href={utilityHref} className={styles.utilityLink} prefetch={false}>
        {utilityLabel}
      </Link>
    </header>
  );
}
