import type { Metadata } from 'next';

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
  },
};

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-10">
      <PeiwanListClient />
    </main>
  );
}
