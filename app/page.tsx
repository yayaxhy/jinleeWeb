import type { Metadata } from 'next';
import Link from 'next/link';

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

const homeTitle = '欧服陪玩｜锦鲤陪玩公会 Jinlee Club';

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
              欧服陪玩｜锦鲤陪玩公会
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
              锦鲤陪玩公会 Jinlee Club 是欧洲最智能的陪玩公会，专注欧服陪玩，24 小时客服全天候为您服务。我们提供 Valorant/无畏契约、英雄联盟、三角洲、Overwatch/OW 等游戏陪玩服务。
            </p>
            <Link
              href="/oufu-peiwan"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/85"
            >
              了解欧服陪玩服务
            </Link>
          </div>
        </div>
      </section>
      <section className="relative z-20 bg-white h-screen w-full overflow-hidden">
        <PeiwanRecommendations />
      </section>
      <section className="bg-[#f7f3ef] px-6 py-16 text-neutral-950">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-700">
              EU Companion Service
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              欧服陪玩常见问题
            </h2>
            <p className="mt-4 text-sm leading-7 text-neutral-700">
              锦鲤陪玩公会围绕欧洲时区、中文沟通和游戏陪玩体验提供服务，帮助玩家更快找到合适的欧服游戏伙伴。
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                question: '锦鲤公会提供欧服陪玩吗？',
                answer:
                  '是的，锦鲤陪玩公会 Jinlee Club 专注欧服陪玩与欧洲游戏陪玩，适合在欧洲时区寻找中文游戏伙伴的玩家。',
              },
              {
                question: '支持哪些游戏陪玩服务？',
                answer:
                  '目前提供 Valorant/无畏契约、英雄联盟、三角洲、Overwatch/OW 等热门游戏陪玩服务。',
              },
              {
                question: '客服时间是多久？',
                answer:
                  '锦鲤陪玩公会提供 24 小时客服，全天候处理咨询、下单和服务问题。',
              },
            ].map((item) => (
              <article
                key={item.question}
                className="rounded-2xl border border-orange-200/70 bg-white p-5 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-neutral-700">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
