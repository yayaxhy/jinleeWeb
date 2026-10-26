import { redirect } from 'next/navigation';

import { GuildConsole } from './GuildConsole';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';

export const metadata = {
  title: '公会工作台｜点了么娱乐公会',
  description: '在一个网页内找陪玩、派单、接单、管理订单与查询账户。',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConsolePage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/accounts/login?callbackUrl=/console');
  }

  return <GuildConsole />;
}
