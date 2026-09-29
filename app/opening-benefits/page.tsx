import { redirect } from 'next/navigation';
import { OpeningBenefitsPanel } from '@/components/opening/OpeningBenefitsPanel';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { getOpeningBenefitsStatus } from '@/lib/opening-benefits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OpeningBenefitsPage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) redirect('/');

  const status = await getOpeningBenefitsStatus({
    dlmId: currentUser.dlmId,
    discordUserId: currentUser.discordUserId,
  });
  return <OpeningBenefitsPanel status={status} />;
}
