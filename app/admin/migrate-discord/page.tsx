import { redirect } from 'next/navigation';
import { MigrateDiscordClient } from '@/components/admin/MigrateDiscordClient';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export default async function MigrateDiscordPage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  return <MigrateDiscordClient />;
}
