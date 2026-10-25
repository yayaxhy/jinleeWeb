import { redirect } from 'next/navigation';
import { isAdminDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';
import { GiftAuditReviewManager } from '@/components/admin/GiftAuditReviewManager';

export const dynamic = 'force-dynamic';
export default async function GiftAuditReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) redirect('/');
  const query = await searchParams;
  return <GiftAuditReviewManager initialTransactionId={typeof query.transactionId === 'string' ? query.transactionId : ''} />;
}
