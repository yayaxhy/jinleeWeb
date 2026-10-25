import type { Viewport } from 'next';
import { redirect } from 'next/navigation';
import BindWechatClient from './BindWechatClient';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };

export default async function WechatBindPage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/');
  }

  if (currentUser.sessionSource !== 'web') {
    redirect('/profile');
  }

  return <BindWechatClient />;
}
