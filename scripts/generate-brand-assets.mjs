// Deterministic size/format exports of the supplied logo; never redraw or crop it.
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const at = (relative) => fileURLToPath(new URL(relative, root));
const source = await readFile(at('public/DLMLOGO.png'));
const png = (width, height = width) => sharp(source)
  .resize(width, height, { fit: 'contain', background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toBuffer();

// Preserve the old favicon instead of deleting it, including on repeat runs.
await mkdir(at('docs/branding/legacy'), { recursive: true });
await copyFile(at('app/favicon.ico'), at('docs/branding/legacy/favicon-jinlee.ico'), constants.COPYFILE_EXCL)
  .catch((error) => { if (error.code !== 'EEXIST') throw error; });

const sizes = [32, 48, 256];
const frames = await Promise.all(sizes.map((size) => png(size)));
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2); // ICO
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] === 256 ? 0 : sizes[index];
  header[entry + 1] = header[entry];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});

await Promise.all([
  writeFile(at('app/favicon.ico'), Buffer.concat([header, ...frames])),
  png(180).then((buffer) => writeFile(at('app/apple-icon.png'), buffer)),
  png(1200, 630).then((buffer) => writeFile(at('public/og-dlmclub-logo.png'), buffer)),
]);
console.log('Exported DLMClub favicon, Apple icon and 1200×630 sharing image. Original logo and old favicon retained.');
