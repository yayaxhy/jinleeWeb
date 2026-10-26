import type { Viewport } from 'next';
import { redirect } from 'next/navigation';
import { EditableCopyManager } from '@/components/admin/EditableCopyManager';
import { canManageGuildOperations } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function EditableCopyPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGuildOperations(session.discordId)) redirect('/');
  return <EditableCopyManager />;
}
