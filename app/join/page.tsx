import type { Metadata, Viewport } from 'next';
import { getServerSession } from '@/lib/session';
import { ApplicationForm } from './ApplicationForm';

export const metadata: Metadata = {
  title: 'DLM 电竞入职申请表',
  description: '填写 DLM 电竞入职申请，由 HR 联系并跟进申请。',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };
export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const session = await getServerSession();
  return <ApplicationForm discordId={session?.discordId ?? null} />;
}
