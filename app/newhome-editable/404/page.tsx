import type { Metadata } from 'next';

import { NewHome404Page } from '@/components/newhome/NewHomePage';
import { readNewHomeContentDocument } from '@/lib/newhome-content';

export const metadata: Metadata = {
  title: 'Warhol Arts Rebuilt / Editable 404',
  description: 'Component-based editable 404 page for the newhome editorial rebuild.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const document = await readNewHomeContentDocument();

  return <NewHome404Page content={document.newHome404Content} />;
}
