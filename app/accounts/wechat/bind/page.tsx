import { redirect } from 'next/navigation';
import BindWechatClient from './BindWechatClient';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

export const dynamic = 'force-dynamic';

export default async function WechatBindPage() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/');
  }

  if (currentUser.sessionSource !== 'web') {
    redirect('/profile');
  }

  return <BindWechatClient />;
}
