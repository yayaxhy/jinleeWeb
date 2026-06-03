import type { Metadata } from 'next';

import { defaultNewHomeContent } from '@/app/newhome/content';
import { NewHomePage } from '@/components/newhome/NewHomePage';
import { readNewHomeContentDocument } from '@/lib/newhome-content';

export const metadata: Metadata = {
  title: `${defaultNewHomeContent.seo.title} / Editable`,
  description: defaultNewHomeContent.seo.description,
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const document = await readNewHomeContentDocument();

  return <NewHomePage content={document.newHomeContent} />;
}
