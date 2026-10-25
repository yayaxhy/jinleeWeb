import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";
import type { Metadata, Viewport } from 'next';
import { getServerSession } from '@/lib/session';
import { ApplicationForm } from './ApplicationForm';

const defaultMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.join.page");
}
