import { redirect } from 'next/navigation';
import { AssetTransferClient } from '@/components/admin/AssetTransferClient';
import { isAdminDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export default async function AssetTransferPage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  return <AssetTransferClient />;
}
