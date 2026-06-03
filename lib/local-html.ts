import { readFile } from 'node:fs/promises';
import path from 'node:path';

function resolvePublicPath(pathSegments: string[]) {
  return path.join(process.cwd(), 'public', ...pathSegments);
}

export async function servePublicHtml(pathSegments: string[]) {
  const htmlPath = resolvePublicPath(pathSegments);

  try {
    const html = await readFile(htmlPath, 'utf8');

    return new Response(html, {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return new Response(`Failed to load local HTML: ${htmlPath}\n${message}`, {
      status: 500,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }
}
