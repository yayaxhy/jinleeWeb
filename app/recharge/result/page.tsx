import { redirect } from 'next/navigation';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { resolveRechargeResultOrderId, type RechargeResultSearchParams } from '@/lib/recharge-result';
import RechargeResultClient from './RechargeResultClient';

export default async function RechargeResult({ searchParams }: { searchParams: Promise<RechargeResultSearchParams> }) {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/');
  }

  const orderId = resolveRechargeResultOrderId(await searchParams);
  return <RechargeResultClient key={orderId ?? 'missing-order'} orderId={orderId} />;
}
