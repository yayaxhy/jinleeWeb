import { redirect } from 'next/navigation';

import { BotConfigManager } from '@/components/admin/BotConfigManager';
import { canManageGuildOperations } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function BotConfigPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGuildOperations(session.discordId)) redirect('/');
  return <BotConfigManager />;
}
