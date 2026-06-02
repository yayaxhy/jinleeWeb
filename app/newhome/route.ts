import path from 'node:path';
import { readFile } from 'node:fs/promises';

export const dynamic = 'force-static';
export const runtime = 'nodejs';

const HTML_FILE = path.join(process.cwd(), 'public', 'newhome', 'index.html');

export async function GET() {
  try {
    const html = await readFile(HTML_FILE, 'utf8');

    return new Response(html, {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=0, must-revalidate',
        'content-type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while loading vendored page';

    return new Response(`Failed to load /newhome: ${message}. Run "npm run newhome:vendor" or rebuild the app so the vendored files are generated under public/newhome.`, {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }
}
