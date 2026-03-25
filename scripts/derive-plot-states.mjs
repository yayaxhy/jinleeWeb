import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const GENERATED_DIR = path.resolve(process.cwd(), 'public', 'farm', 'generated');
const MASTER_FILE = path.join(GENERATED_DIR, 'plot-master.webp');
const FRAME_FILE = path.join(GENERATED_DIR, 'plot-frame.webp');
const EMPTY_FILE = path.join(GENERATED_DIR, 'plot-empty.webp');
const HARVESTED_FILE = path.join(GENERATED_DIR, 'plot-harvested.webp');

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureMaster() {
  if (await fileExists(MASTER_FILE)) return MASTER_FILE;

  const candidates = [FRAME_FILE, EMPTY_FILE];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      await fs.copyFile(candidate, MASTER_FILE);
      return MASTER_FILE;
    }
  }

  throw new Error('Missing plot master asset. Expected one of plot-master.webp, plot-frame.webp, or plot-empty.webp.');
}

function emptyOverlay(width, height) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="174,438 470,329 827,439 535,621" fill="#d6a86d" fill-opacity="0.28"/>
      <ellipse cx="335" cy="474" rx="92" ry="18" fill="#e2bb86" fill-opacity="0.22" transform="rotate(-18 335 474)"/>
      <ellipse cx="470" cy="532" rx="108" ry="20" fill="#e2bb86" fill-opacity="0.2" transform="rotate(-18 470 532)"/>
      <ellipse cx="612" cy="594" rx="112" ry="20" fill="#e2bb86" fill-opacity="0.18" transform="rotate(-18 612 594)"/>
      <ellipse cx="746" cy="652" rx="98" ry="18" fill="#e2bb86" fill-opacity="0.16" transform="rotate(-18 746 652)"/>
      <ellipse cx="560" cy="514" rx="14" ry="8" fill="#f0d5ab" fill-opacity="0.34"/>
      <ellipse cx="676" cy="585" rx="10" ry="6" fill="#f0d5ab" fill-opacity="0.3"/>
      <ellipse cx="415" cy="598" rx="12" ry="7" fill="#f0d5ab" fill-opacity="0.26"/>
    </svg>
  `);
}

function harvestedOverlay(width, height) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="174,438 470,329 827,439 535,621" fill="#6f3b17" fill-opacity="0.14"/>
      <ellipse cx="335" cy="474" rx="96" ry="18" fill="#4e250f" fill-opacity="0.16" transform="rotate(-18 335 474)"/>
      <ellipse cx="470" cy="532" rx="112" ry="20" fill="#4b220d" fill-opacity="0.18" transform="rotate(-18 470 532)"/>
      <ellipse cx="612" cy="594" rx="118" ry="20" fill="#47200c" fill-opacity="0.17" transform="rotate(-18 612 594)"/>
      <ellipse cx="746" cy="652" rx="104" ry="18" fill="#431d0b" fill-opacity="0.15" transform="rotate(-18 746 652)"/>
      <g stroke="#8f6a2b" stroke-width="5" stroke-linecap="round" stroke-opacity="0.58">
        <line x1="310" y1="454" x2="323" y2="446"/>
        <line x1="360" y1="476" x2="372" y2="468"/>
        <line x1="425" y1="503" x2="438" y2="495"/>
        <line x1="495" y1="533" x2="508" y2="525"/>
        <line x1="560" y1="562" x2="572" y2="554"/>
        <line x1="627" y1="590" x2="640" y2="582"/>
        <line x1="694" y1="620" x2="707" y2="612"/>
      </g>
      <g fill="#3b1b08" fill-opacity="0.26">
        <ellipse cx="365" cy="516" rx="18" ry="9" transform="rotate(-18 365 516)"/>
        <ellipse cx="512" cy="581" rx="22" ry="10" transform="rotate(-18 512 581)"/>
        <ellipse cx="646" cy="637" rx="20" ry="9" transform="rotate(-18 646 637)"/>
      </g>
    </svg>
  `);
}

async function deriveStates() {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const masterPath = await ensureMaster();
  const masterBuffer = await fs.readFile(masterPath);
  const meta = await sharp(masterBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  await fs.copyFile(masterPath, FRAME_FILE);

  await sharp(masterBuffer)
    .modulate({ brightness: 1.06, saturation: 0.94 })
    .composite([{ input: emptyOverlay(width, height), blend: 'screen' }])
    .webp({ quality: 100 })
    .toFile(EMPTY_FILE);

  await sharp(masterBuffer)
    .modulate({ brightness: 0.9, saturation: 0.9 })
    .composite([{ input: harvestedOverlay(width, height), blend: 'multiply' }])
    .webp({ quality: 100 })
    .toFile(HARVESTED_FILE);
}

deriveStates().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
