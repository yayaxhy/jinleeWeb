import { redirect } from 'next/navigation';
import type { Viewport } from 'next';
import { getServerSession } from '@/lib/session';
import { canManageGuildOperations } from '@/lib/admin';
import { AuditionLegacyManager } from '@/components/admin/AuditionLegacyManager';
export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };
export default async function AuditionLegacyPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGuildOperations(session.discordId)) redirect('/');
  return <AuditionLegacyManager />;
}
