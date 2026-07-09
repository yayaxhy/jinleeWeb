import type { Metadata } from 'next';

import { NavBar } from '@/components/NavBar';
import { PeiwanRecommendations } from '@/components/home/PeiwanRecommendations';
import { Footer } from '@/components/Footer';
import {
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_WIDTH,
  SITE_URL,
} from '@/lib/site';

const homeTitle = '锦鲤公会｜欧服最智能的陪玩公会';

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
        url: SITE_OG_IMAGE,
        width: SITE_OG_IMAGE_WIDTH,
        height: SITE_OG_IMAGE_HEIGHT,
        alt: `${SITE_NAME}锦鲤 logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
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
              欧服最智能的陪玩公会
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
              锦鲤公会 Jinlee Club 专注欧服游戏陪玩，提供瓦、英雄联盟、三角洲、OW 等游戏陪玩服务。
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
