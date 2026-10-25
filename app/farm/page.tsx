import { localizeSiteMetadata } from '@/lib/site-copy-metadata';
import { getSiteCopy } from '@/lib/site-copy-server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { FarmClient } from '@/components/farm/FarmClient';
import { getFarmDashboard } from '@/lib/farm';
import { resolveFarmSession } from '@/lib/farmDevSession';
import { getServerSession } from '@/lib/session';

const defaultMetadata: Metadata = {
  title: '点了么庄园',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FarmPage() {
  const baseSession = await getServerSession().catch(() => null);
  const session = await resolveFarmSession(baseSession, (await headers()).get('host'));
  if (!session?.discordId) {
    redirect('/accounts/discord/login?callbackUrl=%2Ffarm');
  }

  const dashboard = await getFarmDashboard(session.discordId);

  return <FarmClient initialDashboard={dashboard} />;
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), 'site.app.farm.page');
}
