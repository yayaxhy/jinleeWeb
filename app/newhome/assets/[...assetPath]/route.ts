import path from 'node:path';
import { readFile } from 'node:fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = {
  assetPath: string[];
};

const ASSET_ROOT = path.join(process.cwd(), 'public', 'newhome', 'assets');

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.avif':
      return 'image/avif';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.eot':
      return 'application/vnd.ms-fontobject';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.mp3':
      return 'audio/mpeg';
    case '.mp4':
      return 'video/mp4';
    case '.ogg':
      return 'audio/ogg';
    case '.otf':
      return 'font/otf';
    case '.png':
      return 'image/png';
    case '.splinecode':
      return 'application/octet-stream';
    case '.svg':
      return 'image/svg+xml';
    case '.ttf':
      return 'font/ttf';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'video/webm';
    case '.webp':
      return 'image/webp';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.xml':
      return 'application/xml; charset=utf-8';
    default:
      if (path.basename(filePath) === 'split-type') {
        return 'application/javascript; charset=utf-8';
      }

      return 'application/octet-stream';
  }
}

function resolveAssetPath(parts: string[]) {
  const resolvedPath = path.join(ASSET_ROOT, ...parts);
  const normalizedRoot = `${ASSET_ROOT}${path.sep}`;
  const normalizedResolved = path.normalize(resolvedPath);

  if (!normalizedResolved.startsWith(normalizedRoot)) {
    return null;
  }

  return normalizedResolved;
}

export async function GET(_request: Request, context: { params: Promise<RouteParams> }) {
  const { assetPath } = await context.params;
  const resolvedPath = resolveAssetPath(assetPath);

  if (!resolvedPath) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const body = await readFile(resolvedPath);

    return new Response(body, {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': contentTypeFor(resolvedPath),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
