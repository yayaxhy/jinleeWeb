import { redirect } from 'next/navigation';
import { LotteryFusionClient } from '@/components/profile/LotteryFusionClient';
import { getLotteryFusionPageData } from '@/lib/lottery-fusion-page-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LotteryFusionPage() {
  const data = await getLotteryFusionPageData();
  if (!data) {
    redirect('/');
  }

  return (
    <LotteryFusionClient
      initialItems={data.initialItems}
      membership={data.membership}
      embeddedInProfile
    />
  );
}
