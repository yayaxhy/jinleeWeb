import type { Metadata } from 'next';

import { NavBar } from '@/components/NavBar';
import { PeiwanRecommendations } from '@/components/home/PeiwanRecommendations';
import { Footer } from '@/components/Footer';
import {
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from '@/lib/site';

const homeTitle = '锦鲤公会｜Valorant、Overwatch 游戏陪玩社区';

export const metadata: Metadata = {
  title: homeTitle,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    siteName: SITE_NAME,
    title: homeTitle,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/bg.png',
        width: 1490,
        height: 936,
        alt: `${SITE_NAME}游戏陪玩社区`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
    description: SITE_DESCRIPTION,
    images: ['/bg.png'],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      sameAs: ['https://discord.gg/mUNUNQEmCA'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'zh-CN',
      publisher: {
        '@id': `${SITE_URL}/#organization`,
      },
    },
  ],
};

export default function Home() {
  return (
    <main className="min-h-screen relative text-neutral-900 bg-white flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <section className="relative h-screen w-full overflow-hidden">
        <video
          src="/homePage/FINAL.mp4"
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="relative z-20">
          <NavBar />
        </div>
        <div className="absolute inset-0 z-10 flex items-end justify-center px-6 pb-12 text-center text-white">
          <div className="max-w-3xl rounded-3xl bg-black/30 px-6 py-5 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-[0.5em] text-white/80">
              Jinlee Club
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-wide sm:text-5xl">
              锦鲤公会游戏陪玩社区
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
              来认识锦鲤公会小伙伴们吧。
            </p>
          </div>
        </div>
      </section>
      <section className="relative z-20 bg-white h-screen w-full overflow-hidden">
        <PeiwanRecommendations />
      </section>
      <Footer />
    </main>
  );
}
