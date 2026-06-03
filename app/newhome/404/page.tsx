import type { Metadata } from 'next';

import { NewHome404Page } from '@/components/newhome/NewHomePage';
import { readNewHomeContentDocument } from '@/lib/newhome-content';

export const metadata: Metadata = {
  title: 'Warhol Arts Rebuilt / 404',
  description: 'Component-based local 404 page for the rebuilt newhome route.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const document = await readNewHomeContentDocument();

  return <NewHome404Page content={document.newHome404Content} />;
}
