import type { Metadata } from 'next';
import Link from 'next/link';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_WIDTH,
  SITE_URL,
} from '@/lib/site';

const pageTitle = '欧服陪玩｜欧洲游戏陪玩服务｜锦鲤陪玩公会 Jinlee Club';
const pageDescription =
  '锦鲤陪玩公会 Jinlee Club 是欧洲最智能的陪玩公会，专注欧服陪玩与欧洲游戏陪玩，24 小时客服全天候为您服务，提供 Valorant/无畏契约、英雄联盟、三角洲、Overwatch/OW 等游戏陪玩服务。';

const games = [
  'Valorant/无畏契约欧服陪玩',
  '英雄联盟欧服陪玩',
  '三角洲欧服陪玩',
  'Overwatch/OW 欧服陪玩',
];

const faqs = [
  {
    question: '锦鲤公会提供欧服陪玩吗？',
    answer:
      '是的，锦鲤陪玩公会 Jinlee Club 专注欧服陪玩与欧洲游戏陪玩，适合在欧洲时区寻找中文游戏伙伴的玩家。',
  },
  {
    question: '锦鲤陪玩公会支持哪些游戏？',
    answer:
      '目前提供 Valorant/无畏契约、英雄联盟、三角洲、Overwatch/OW 等热门游戏陪玩服务，后续会继续扩展更多游戏品类。',
  },
  {
    question: '客服是 24 小时在线吗？',
    answer:
      '锦鲤陪玩公会提供 24 小时客服，全天候处理咨询、下单、服务匹配和售后问题。',
  },
  {
    question: '欧洲陪玩和欧服陪玩有什么区别？',
    answer:
      '欧洲陪玩更强调欧洲地区与欧洲时区，欧服陪玩更强调游戏服务器。锦鲤陪玩公会同时覆盖这两类需求。',
  },
];

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: '/oufu-peiwan',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/oufu-peiwan',
    siteName: SITE_NAME,
    title: pageTitle,
    description: pageDescription,
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
    title: pageTitle,
    description: pageDescription,
    images: [SITE_OG_IMAGE],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/oufu-peiwan#webpage`,
      url: `${SITE_URL}/oufu-peiwan`,
      name: pageTitle,
      description: pageDescription,
      inLanguage: 'zh-CN',
      isPartOf: {
        '@id': `${SITE_URL}/#website`,
      },
    },
    {
      '@type': 'Service',
      '@id': `${SITE_URL}/oufu-peiwan#service`,
      name: '欧服陪玩服务',
      alternateName: '欧洲游戏陪玩服务',
      provider: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
      },
      areaServed: 'Europe',
      serviceType: '游戏陪玩',
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/oufu-peiwan#faq`,
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ],
};

export default function OufuPeiwanPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ef] text-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <NavBar />
      <section className="relative overflow-hidden px-6 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(220,38,38,0.16),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-700">
            Jinlee Club
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            欧服陪玩｜锦鲤陪玩公会
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-neutral-700 sm:text-lg">
            锦鲤陪玩公会 Jinlee Club 是欧洲最智能的陪玩公会，专注欧服陪玩，24 小时客服全天候为您服务。我们提供 Valorant/无畏契约、英雄联盟、三角洲、Overwatch/OW 等游戏陪玩服务。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/peiwanList"
              className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              查看陪玩列表
            </Link>
            <Link
              href="https://discord.gg/mUNUNQEmCA"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-neutral-950 px-6 py-3 text-sm font-semibold transition hover:bg-white"
            >
              加入 Discord
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-4">
          {games.map((game) => (
            <article key={game} className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{game}</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-700">
                面向欧洲时区玩家，提供中文沟通、游戏组队和陪玩服务。
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-3xl bg-white p-6 shadow-sm md:grid-cols-[0.9fr_1.1fr] md:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-700">
              Why Jinlee
            </p>
            <h2 className="mt-4 text-3xl font-semibold">为什么选择锦鲤欧服陪玩？</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['欧洲时区覆盖', '围绕欧服玩家常用时间段提供陪玩和客服支持。'],
              ['中文沟通', '适合在欧洲生活、留学或使用欧服账号的中文玩家。'],
              ['多游戏覆盖', '覆盖 Valorant、英雄联盟、三角洲、Overwatch/OW 等热门游戏。'],
              ['24 小时客服', '全天候处理咨询、下单、匹配和服务反馈。'],
            ].map(([title, text]) => (
              <article key={title} className="rounded-2xl border border-neutral-200 p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-neutral-700">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-semibold">欧服陪玩常见问题</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((item) => (
              <article key={item.question} className="rounded-2xl bg-white p-5 shadow-sm">
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
