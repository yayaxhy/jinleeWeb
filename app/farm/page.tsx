import { redirect } from 'next/navigation';
import { FarmClient } from '@/components/farm/FarmClient';
import { getFarmDashboard } from '@/lib/farm';
import { getServerSession } from '@/lib/session';

export const metadata = {
  title: '锦鲤庄园',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FarmPage() {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/accounts/discord/login?callbackUrl=%2Ffarm');
  }

  const dashboard = await getFarmDashboard(session.discordId);

  return <FarmClient initialDashboard={dashboard} />;
}
