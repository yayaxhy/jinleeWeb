import { newhomeHoverFixScript } from '@/lib/newhome-hover-fix';
import { renderHtmlDocument } from '@/lib/render-html-document';
import { newhomeDocument } from './_generated/index';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const html = renderHtmlDocument({
    ...newhomeDocument,
    bodyAppendHtml: newhomeHoverFixScript,
  });

  return new Response(html, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
