import { servePublicHtml } from '@/lib/local-html';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return servePublicHtml(['newhome', '404', 'index.html']);
}
