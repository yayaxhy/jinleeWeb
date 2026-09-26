import { redirect } from 'next/navigation';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { resolveRechargeResultOrderId, type RechargeResultSearchParams } from '@/lib/recharge-result';
import RechargeResultClient from './RechargeResultClient';

export default async function RechargeResult({ searchParams }: { searchParams: Promise<RechargeResultSearchParams> }) {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/');
  }

  const orderId = resolveRechargeResultOrderId(await searchParams);
  return <RechargeResultClient key={orderId ?? 'missing-order'} orderId={orderId} />;
}
