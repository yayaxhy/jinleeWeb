import { redirect } from 'next/navigation';
import { OpeningBenefitsPanel } from '@/components/opening/OpeningBenefitsPanel';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { getOpeningBenefitsStatus } from '@/lib/opening-benefits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OpeningBenefitsPage() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) redirect('/');

  const status = await getOpeningBenefitsStatus({
    jinleeId: currentUser.jinleeId,
    discordUserId: currentUser.discordUserId,
  });
  return <OpeningBenefitsPanel status={status} />;
}
