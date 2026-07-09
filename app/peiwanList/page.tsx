import type { Metadata } from 'next';

import {
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_WIDTH,
} from '@/lib/site';

import { PeiwanListClient } from './PeiwanListClient';

export const metadata: Metadata = {
  title: '欧服陪玩列表｜锦鲤公会',
  description: '查看锦鲤公会欧服最智能的陪玩公会推荐、擅长游戏与服务价格，寻找合适的欧服游戏伙伴。',
  alternates: {
    canonical: '/peiwanList',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/peiwanList',
    title: '欧服陪玩列表｜锦鲤公会',
    description: '查看锦鲤公会欧服最智能的陪玩公会推荐、擅长游戏与服务价格，寻找合适的欧服游戏伙伴。',
    images: [
      {
        url: SITE_OG_IMAGE,
        width: SITE_OG_IMAGE_WIDTH,
        height: SITE_OG_IMAGE_HEIGHT,
        alt: '锦鲤公会锦鲤 logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '欧服陪玩列表｜锦鲤公会',
    description: '查看锦鲤公会欧服最智能的陪玩公会推荐、擅长游戏与服务价格，寻找合适的欧服游戏伙伴。',
    images: [SITE_OG_IMAGE],
  },
};

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-10">
      <PeiwanListClient />
    </main>
  );
}
