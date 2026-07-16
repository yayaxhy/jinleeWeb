/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';
import {
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_WIDTH,
  SITE_URL,
} from '@/lib/site';
import {
  loadHomePageData,
  type PeriodKey,
  type RankingData,
  type RecommendedCompanion,
  type RecentDispatchItem,
} from '@/lib/home-page-data';
import { JinleeHoverLetters } from '@/components/home/JinleeHoverLetters';
import { RankingPeriodCard } from '@/components/home/RankingPeriodCard';
import { DiscordSupportLink } from '@/components/home/DiscordSupportLink';
import { DispatchTicker } from '@/components/home/DispatchTicker';

const homeTitle = '欧服陪玩｜锦鲤陪玩公会 Jinlee Club';
const periods: PeriodKey[] = ['日榜', '周榜', '月榜'];
const SHOW_RECOMMENDED_COMPANIONS = false;

export const dynamic = 'force-dynamic';

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
      sameAs: ['https://discord.gg/UJ95zhfJYR'],
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
    {
      '@type': 'Service',
      '@id': `${SITE_URL}/#eu-companion-service`,
      name: '欧服游戏陪玩服务',
      serviceType: '游戏陪玩社区与陪玩服务',
      provider: {
        '@id': `${SITE_URL}/#organization`,
      },
      areaServed: ['Europe', '欧洲'],
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: SITE_URL,
      },
      description: SITE_DESCRIPTION,
    },
  ],
};

const faqs = [
  ['怎么开始找陪玩？', '加入 Discord 服务器或联系在线客服，说明需求即可。'],
  ['支持哪些游戏？', 'Valorant，英雄联盟，三角洲，APEX 等热门大型游戏。'],
  ['联系客服时需要说明什么？', '告诉客服游戏，段位和其他要求即可。'],
];

function HomeStyles() {
  return (
    <style>{`
      @keyframes jinlee-home-flow {
        0% { transform: translate3d(-8%, -5%, 0) scale(1); filter: hue-rotate(0deg); }
        45% { transform: translate3d(5%, 7%, 0) scale(1.08); filter: hue-rotate(-18deg); }
        100% { transform: translate3d(10%, -2%, 0) scale(1.04); filter: hue-rotate(26deg); }
      }

      .jinlee-home-field {
        background:
          radial-gradient(circle at 16% 18%, rgba(255, 113, 68, 0.36), transparent 26%),
          radial-gradient(circle at 72% 20%, rgba(123, 92, 255, 0.32), transparent 24%),
          radial-gradient(circle at 55% 76%, rgba(19, 168, 129, 0.22), transparent 30%),
          linear-gradient(135deg, #050506 0%, #11100d 38%, #281206 66%, #08090b 100%);
        animation: jinlee-home-flow 18s ease-in-out infinite alternate;
      }

      .jinlee-home-noise {
        background-image:
          linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: linear-gradient(to bottom, black, transparent 88%);
      }

      .jinlee-home-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(251,146,60,0.65) rgba(255,255,255,0.08);
      }

      .jinlee-home-scrollbar::-webkit-scrollbar {
        height: 8px;
      }

      .jinlee-home-scrollbar::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
      }

      .jinlee-home-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(251,146,60,0.65);
        border-radius: 999px;
      }
    `}</style>
  );
}

function HeroPanel({ dispatches }: { dispatches: RecentDispatchItem[] }) {
  return (
    <section className="relative px-6 pb-10 pt-8 md:pb-12 md:pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-7 max-w-5xl text-center">
          <h1 className="text-[clamp(2.65rem,6vw,5.7rem)] font-black leading-[0.9] tracking-[-0.075em] text-orange-200/80">
            锦鲤陪玩公会
          </h1>
          <p className="mx-auto mt-4 inline-flex rounded-full border border-white/12 bg-white/[0.055] px-4 py-1.5 text-xs font-semibold tracking-[0.28em] text-white/42 backdrop-blur md:text-sm">
            欧服陪玩社区
          </p>
        </div>

        <JinleeHoverLetters word="JINLEE" showIntro={false} className="mt-0" size="hero" />

        <div className="mx-auto mt-6 max-w-4xl text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="https://discord.gg/UJ95zhfJYR"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-b from-[#f8d990] to-[#bd7d1e] px-9 py-4 text-base font-bold text-[#211203] shadow-[0_12px_28px_rgba(190,125,30,0.3)] transition hover:-translate-y-0.5 hover:from-[#ffe6aa] hover:to-[#d89632]"
            >
              加入 Discord
            </Link>
            <DiscordSupportLink
              className="rounded-full bg-gradient-to-b from-[#f8d990] to-[#bd7d1e] px-9 py-4 text-base font-bold text-[#211203] shadow-[0_12px_28px_rgba(190,125,30,0.3)] transition hover:-translate-y-0.5 hover:from-[#ffe6aa] hover:to-[#d89632]"
              style={{}}
            >
              联系客服
            </DiscordSupportLink>
            <DiscordSupportLink
              className="rounded-full bg-gradient-to-b from-[#f8d990] to-[#bd7d1e] px-9 py-4 text-base font-bold text-[#211203] shadow-[0_12px_28px_rgba(190,125,30,0.3)] transition hover:-translate-y-0.5 hover:from-[#ffe6aa] hover:to-[#d89632]"
              style={{}}
              discordUserId="308164614846414851"
            >
              申请陪玩入职
            </DiscordSupportLink>
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-white/64 md:text-base">
            锦鲤陪玩公会 Jinlee Club，欧洲最智能的陪玩公会，专注欧服陪玩，24小时客服全天候为您服务。提供 Valorant/无畏契约、英雄联盟、三角洲、Overwatch/OW 等游戏陪玩服务。
          </p>
          <DispatchTicker dispatches={dispatches} />
        </div>
      </div>
    </section>
  );
}

function RankingRail({
  eyebrow,
  title,
  description,
  data,
  accent,
  showTag = true,
  showVipLevel = false,
  honor = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  data: RankingData;
  accent: string;
  showTag?: boolean;
  showVipLevel?: boolean;
  honor?: boolean;
}) {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-8 pt-10 md:pb-10 md:pt-12">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-200/70">{eyebrow}</p>
            {honor ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-100/25 bg-amber-200/10 px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.16em] text-amber-100">♛ 荣耀榜单</span> : null}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#fff7ed] md:text-5xl">{title}</h2>
        </div>
        {description ? <p className="max-w-xl text-sm leading-7 text-white/54">{description}</p> : null}
      </div>

      <div className="jinlee-home-scrollbar flex snap-x gap-5 overflow-x-auto pb-5">
        {periods.map((period) => (
          <RankingPeriodCard
            key={period}
            period={period}
            items={data[period]}
            accent={accent}
            emptyLabel="榜单更新中"
            showTag={showTag}
            showVipLevel={showVipLevel}
          />
        ))}
      </div>
    </section>
  );
}

function CompanionImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className: string;
}) {
  if (!src) {
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/10 to-orange-200/10 text-sm text-white/42">
        推荐图更新中
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}

function CommunityFloor({ companions }: { companions: RecommendedCompanion[] }) {
  const [primaryCompanion, ...secondaryCompanions] = companions;

  if (!primaryCompanion) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[2rem] border border-white/10 bg-[#11100d]/80 p-8 text-center">
          <p className="text-xs font-semibold tracking-[0.45em] text-orange-200/70">推荐陪玩</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.055em] text-[#fff7ed]">推荐陪玩更新中</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/50">
            你可以先进入陪玩列表查看所有可预约的锦鲤陪玩。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.45em] text-orange-200/70">推荐陪玩</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.055em] text-[#fff7ed] md:text-6xl">
            本周推荐陪玩
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/50">
            精选陪玩会根据推荐图、游戏标签和当前资料展示。想看完整名单，可以进入陪玩列表继续筛选。
          </p>
        </div>
        <Link
          href="/peiwanList"
          className="w-fit rounded-full border border-white/14 px-5 py-2.5 text-sm font-semibold text-white/62 transition hover:bg-white/10"
        >
          查看全部陪玩
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="group relative overflow-hidden rounded-[2.4rem] border border-orange-200/15 bg-[#11100d]/86 shadow-[0_30px_100px_rgba(0,0,0,0.36)] backdrop-blur">
          <div className={`absolute inset-0 bg-gradient-to-br ${primaryCompanion.tone} opacity-35 transition duration-500 group-hover:opacity-48`} />
          <div className="relative grid min-h-[560px] gap-0 md:grid-cols-[0.92fr_1.08fr]">
            <div className="relative min-h-[360px] overflow-hidden bg-black/30 md:min-h-full">
              <CompanionImage
                src={primaryCompanion.image}
                alt={`${primaryCompanion.name} 陪玩推荐图`}
                className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#11100d] via-transparent to-transparent md:bg-gradient-to-r" />
            </div>
            <div className="relative flex flex-col justify-end p-6 md:p-8">
              <div className="mb-auto flex items-center justify-between gap-3">
                <span className="rounded-full border border-white/14 bg-black/20 px-3 py-1 text-xs font-semibold tracking-[0.22em] text-orange-100/78">
                  主推陪玩
                </span>
                <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-semibold text-emerald-100">
                  在线推荐
                </span>
              </div>
              <p className="mt-8 text-sm font-semibold tracking-[0.36em] text-white/35">
                #{primaryCompanion.id}
              </p>
              <h3 className="mt-3 text-5xl font-black tracking-[-0.06em] text-[#fff7ed] md:text-7xl">
                {primaryCompanion.name}
              </h3>
              <p className="mt-4 text-xl font-semibold text-orange-100/86">
                {primaryCompanion.game}
              </p>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/55">
                {primaryCompanion.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {primaryCompanion.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/58">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="text-lg font-black text-[#fff7ed]">{primaryCompanion.price}</span>
                <Link
                  href="/peiwanList"
                  className="rounded-full bg-[#fff7ed] px-5 py-2.5 text-sm font-semibold text-[#15100c] transition hover:bg-orange-100"
                >
                  查看陪玩列表
                </Link>
              </div>
            </div>
          </div>
        </article>

        <div className="grid gap-5">
          {secondaryCompanions.map((item) => (
            <article
              key={item.id}
              className="group grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#11100d]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur transition hover:-translate-y-1 hover:border-orange-200/20 sm:grid-cols-[190px_1fr]"
            >
              <div className="relative min-h-[220px] bg-black/30 sm:min-h-0">
                <CompanionImage
                  src={item.image}
                  alt={`${item.name} 陪玩推荐图`}
                  className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.04]"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${item.tone} opacity-28`} />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.28em] text-orange-200/58">
                      {item.highlight}
                    </p>
                    <h3 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#fff7ed]">
                      {item.name}
                    </h3>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/35">
                    #{item.id}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white/64">{item.game}</p>
                <p className="mt-3 text-sm leading-6 text-white/42">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.055] px-2.5 py-1 text-xs text-white/45">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm font-black text-orange-100">{item.price}</p>
              </div>
            </article>
          ))}
          <Link
            href="/peiwanList"
            className="rounded-[2rem] border border-dashed border-white/16 bg-white/[0.035] p-5 text-center text-sm font-semibold text-white/54 transition hover:bg-white/[0.07]"
          >
            进入陪玩列表查看更多推荐 →
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: '加入 Discord',
      text: '点击 加入 Discord 服务器',
      href: 'https://discord.gg/UJ95zhfJYR',
      openInNewTab: true,
    },
    {
      step: '02',
      title: '联系客服',
      text: '点击 联系客服',
      support: true,
    },
    {
      step: '03',
      title: '确认需求',
      text: '说明游戏、段位和其他要求',
    },
  ];

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-7xl rounded-[2.4rem] bg-[#f7f0e8] p-6 text-[#17110d] md:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.42em] text-orange-700">服务流程</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">怎么开始</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(({ step, title, text, href, openInNewTab, support }, index) => {
              const content = (
                <>
                  <p className="text-sm font-black text-orange-600">{step}</p>
                  <h3 className="mt-3 font-semibold md:mt-8">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
                </>
              );
              const className = `block rounded-[1.7rem] bg-white p-5 shadow-sm transition hover:shadow-md md:min-h-[210px] ${index % 2 === 0 ? '' : 'md:translate-y-6'}`;

              return support ? (
                <DiscordSupportLink key={step} className={className} style={{}}>
                  {content}
                </DiscordSupportLink>
              ) : href ? (
                <a
                  key={step}
                  href={href}
                  target={openInNewTab ? '_blank' : undefined}
                  rel={openInNewTab ? 'noopener noreferrer' : undefined}
                  className={className}
                  style={{}}
                >
                  {content}
                </a>
              ) : (
                <article key={step} className={className}>
                  {content}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="mx-auto grid max-w-7xl gap-7 px-6 py-16 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-200/70">常见问题</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[#fff7ed]">公会新手指南</h2>
      </div>
      <div className="space-y-3">
        {faqs.map(([question, answer]) => (
          <article key={question} className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5">
            <h3 className="font-semibold text-[#fff7ed]">{question}</h3>
            <p className="mt-2 text-sm leading-7 text-white/55">{answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const homeData = await loadHomePageData();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050506] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <HomeStyles />
      <div className="jinlee-home-field fixed inset-0 -z-30" />
      <div className="jinlee-home-noise pointer-events-none fixed inset-0 -z-20 opacity-55" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,0.18)_45%,rgba(0,0,0,0.74)_100%)]" />

      <NavBar />
      <HeroPanel dispatches={homeData.recentDispatches} />
      <RankingRail
        eyebrow="老板榜单"
        title="锦鲤老板榜"
        data={homeData.bossRankings}
        accent="bg-orange-300"
        showTag={false}
        showVipLevel
        honor
      />
      <RankingRail
        eyebrow="陪玩榜单"
        title="陪玩人气榜"
        data={homeData.companionRankings}
        accent="bg-orange-300"
      />
      {SHOW_RECOMMENDED_COMPANIONS ? <CommunityFloor companions={homeData.recommendedCompanions} /> : null}
      <HowItWorks />
      <FaqSection />
      <Footer />
    </main>
  );
}
