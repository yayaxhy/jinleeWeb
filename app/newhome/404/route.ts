import { renderHtmlDocument } from '@/lib/render-html-document';
import { newhomeDocument } from './_source/document';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const html = renderHtmlDocument(newhomeDocument);

  return new Response(html, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
