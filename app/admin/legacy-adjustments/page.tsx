import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';
import { LegacyAdjustmentManager } from '@/components/admin/LegacyAdjustmentManager';

export const dynamic = 'force-dynamic';
export default async function LegacyAdjustmentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) redirect('/');
  const query = await searchParams;
  return <LegacyAdjustmentManager initialKind={query.kind === 'ORDER' ? 'ORDER' : 'GIFT'} initialId={typeof query.id === 'string' ? query.id : ''} initialRequestId={typeof query.requestId === 'string' ? query.requestId : ''} />;
}
