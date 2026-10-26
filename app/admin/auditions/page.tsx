import { redirect } from 'next/navigation';
import { canManageGuildOperations } from '@/lib/admin';
import { getServerSession } from '@/lib/session';
import { AuditionReviewManager } from '@/components/admin/AuditionReviewManager';

export const dynamic = 'force-dynamic';
export default async function AuditionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGuildOperations(session.discordId)) redirect('/');
  const query = await searchParams;
  return <AuditionReviewManager initialInviteId={typeof query.inviteId === 'string' ? query.inviteId : ''} />;
}
