import { redirect } from 'next/navigation';
import { StripePricingCalculator } from '@/components/admin/StripePricingCalculator';
import { canViewStripePricing } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export default async function StripePricingPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewStripePricing(session.discordId)) {
    redirect('/');
  }

  return <StripePricingCalculator />;
}
