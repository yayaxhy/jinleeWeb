import { redirect } from 'next/navigation';
import { isAdminDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';
import { GiftRequestManager } from '@/components/admin/GiftRequestManager';

export const dynamic = 'force-dynamic';
export default async function GiftRequestsPage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) redirect('/');
  return <GiftRequestManager />;
}
