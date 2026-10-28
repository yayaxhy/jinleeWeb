import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { COPY_IMAGE_MAX_BYTES } from './editable-copy-image-policy';

export { COPY_IMAGE_MAX_BYTES } from './editable-copy-image-policy';
const MAX_PIXELS = 40_000_000;
const MAX_FRAMES = 500;
const NAME = /^[a-f0-9]{64}\.(png|jpg|webp|gif)$/;
export const COPY_IMAGE_URL_PREFIX = '/api/copy/images/';
export type CopyImageFailure = 'too_large' | 'unsupported' | 'unreadable' | 'dimensions' | 'missing';
export class CopyImageStorageError extends Error {
  constructor(readonly code: CopyImageFailure) { super(code); }
}
export const getCopyImageStorageDir = () => process.env.COPY_IMAGE_STORAGE_DIR?.trim() || path.join(process.cwd(), 'storage', 'copy-images');
export function copyImageName(url: string): string | null {
  const name = url.startsWith(COPY_IMAGE_URL_PREFIX) ? url.slice(COPY_IMAGE_URL_PREFIX.length) : '';
  return NAME.test(name) ? name : null;
}
export async function readCopyImageBody(request: Request): Promise<Buffer> {
  if (Number(request.headers.get('content-length')) > COPY_IMAGE_MAX_BYTES) throw new CopyImageStorageError('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new CopyImageStorageError('unreadable');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > COPY_IMAGE_MAX_BYTES) { await reader.cancel(); throw new CopyImageStorageError('too_large'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new CopyImageStorageError('unreadable');
  return Buffer.concat(chunks);
}
function detectFormat(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}
export async function storeCopyImage(bytes: Buffer, directory = getCopyImageStorageDir()) {
  if (!bytes.length) throw new CopyImageStorageError('unreadable');
  if (bytes.length > COPY_IMAGE_MAX_BYTES) throw new CopyImageStorageError('too_large');
  const format = detectFormat(bytes);
  if (!format) throw new CopyImageStorageError('unsupported');
  const metadata = await sharp(bytes, { animated: true, limitInputPixels: false, failOn: 'error' }).metadata().catch(() => null);
  if (!metadata?.width || !metadata.height || metadata.format !== format) throw new CopyImageStorageError('unreadable');
  const frames = metadata.pages ?? 1;
  const frameHeight = metadata.pageHeight ?? metadata.height;
  if (metadata.width > 16384 || frameHeight > 16384 || frames > MAX_FRAMES || metadata.width * frameHeight * frames > MAX_PIXELS) throw new CopyImageStorageError('dimensions');
  // Decode all frames, but retain the original bytes so animated GIF/WebP files
  // do not lose their animation, transparency or timing when published.
  await sharp(bytes, { animated: true, limitInputPixels: MAX_PIXELS, failOn: 'error' }).resize(1, 1).raw().toBuffer()
    .catch(() => { throw new CopyImageStorageError('unreadable'); });
  const extension = format === 'jpeg' ? 'jpg' : format;
  const name = `${crypto.createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${crypto.randomUUID()}.tmp`);
  const destination = path.join(directory, name);
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o644 });
    // Link a fully written inode without replacing any existing immutable image.
    await fs.link(temporary, destination).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
    const existing = await fs.readFile(destination);
    if (!existing.equals(bytes)) throw new CopyImageStorageError('unreadable');
  } finally { await fs.unlink(temporary).catch(() => {}); }
  return { url: `${COPY_IMAGE_URL_PREFIX}${name}`, width: metadata.width, height: frameHeight };
}
export async function loadCopyImage(name: string, directory = getCopyImageStorageDir()) {
  if (!NAME.test(name)) return null;
  try {
    const bytes = await fs.readFile(path.join(directory, name));
    const extension = name.split('.').at(-1)!;
    const type = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    return { bytes, type };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
export async function assertCopyImagesExist(overrides: Record<string, string>, imageKeys: ReadonlySet<string>, directory = getCopyImageStorageDir()) {
  for (const [key, value] of Object.entries(overrides)) {
    if (!imageKeys.has(key)) continue;
    const name = copyImageName(value);
    if (!name) continue; // A registered built-in default is validated by the contract.
    const stat = await fs.stat(path.join(directory, name)).catch(() => null);
    if (!stat?.isFile() || !stat.size) throw new CopyImageStorageError('missing');
  }
}
