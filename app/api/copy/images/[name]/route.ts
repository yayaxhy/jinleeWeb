import { loadCopyImage } from '@/lib/editable-copy-image-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await context.params;
    const image = await loadCopyImage(name);
    if (!image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(image.bytes), { headers: {
      'Content-Type': image.type, 'Content-Length': String(image.bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
      ETag: `"${name}"`,
    } });
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
