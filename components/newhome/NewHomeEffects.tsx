'use client';

import { useEffect } from 'react';

export function NewHomeEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';

    const revealElements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.14,
      },
    );

    revealElements.forEach((element) => revealObserver.observe(element));

    const tiltElements = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));
    const tiltCleanups = tiltElements.map((element) => {
      const handleMove = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 10;
        const rotateX = (0.5 - y) * 10;
        element.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      };

      const reset = () => {
        element.style.transform = '';
      };

      element.addEventListener('pointermove', handleMove);
      element.addEventListener('pointerleave', reset);
      element.addEventListener('pointercancel', reset);

      return () => {
        element.removeEventListener('pointermove', handleMove);
        element.removeEventListener('pointerleave', reset);
        element.removeEventListener('pointercancel', reset);
      };
    });

    const parallaxElements = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
    const updateParallax = () => {
      const scrollY = window.scrollY;
      parallaxElements.forEach((element) => {
        const offset = Math.min(scrollY * 0.08, 72);
        element.style.transform = `translate3d(0, ${offset}px, 0) scale(1.08)`;
      });
    };

    updateParallax();
    window.addEventListener('scroll', updateParallax, { passive: true });

    return () => {
      root.style.scrollBehavior = previousScrollBehavior;
      revealObserver.disconnect();
      tiltCleanups.forEach((cleanup) => cleanup());
      window.removeEventListener('scroll', updateParallax);
    };
  }, []);

  return null;
}
