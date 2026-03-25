import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const GENERATED_DIR = path.resolve(process.cwd(), 'public', 'farm', 'generated');
const NORMALIZED_DIR = path.join(GENERATED_DIR, 'normalized');
const CROP_SUFFIXES = ['-sprout.webp', '-young.webp', '-mature.webp', '-ready.webp'];

function getPixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

function averageRgb(pixels) {
  const total = pixels.reduce(
    (acc, [r, g, b]) => {
      acc.r += r;
      acc.g += g;
      acc.b += b;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: total.r / pixels.length,
    g: total.g / pixels.length,
    b: total.b / pixels.length,
  };
}

function colorDistanceSq(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function pickCornerSamples(data, width, height, sampleSize = 24) {
  const samples = [];
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const offset = getPixelOffset(width, x, y);
        samples.push([data[offset], data[offset + 1], data[offset + 2]]);
      }
    }
  }

  return samples;
}

function getAlphaBbox(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[getPixelOffset(width, x, y) + 3];
      if (alpha === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function extractLargestForegroundMask(data, width, height) {
  const background = averageRgb(pickCornerSamples(data, width, height));
  const thresholdSq = 24 * 24;
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = getPixelOffset(width, x, y);
      const alpha = data[offset + 3];
      if (alpha === 0) continue;
      const pixel = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      if (colorDistanceSq(pixel, background) > thresholdSq) {
        mask[y * width + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  let bestComponent = null;
  let bestArea = 0;
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;

      const stack = [start];
      const component = [];
      visited[start] = 1;

      while (stack.length > 0) {
        const current = stack.pop();
        component.push(current);
        const cx = current % width;
        const cy = Math.floor(current / width);

        for (const [dx, dy] of directions) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!mask[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }

      if (component.length > bestArea) {
        bestArea = component.length;
        bestComponent = component;
      }
    }
  }

  return bestComponent;
}

async function normalizeCropFile(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const component = extractLargestForegroundMask(data, info.width, info.height);
  if (!component || component.length === 0) return;

  const isolated = Buffer.alloc(data.length);
  for (const index of component) {
    const offset = index * 4;
    isolated[offset + 0] = data[offset + 0];
    isolated[offset + 1] = data[offset + 1];
    isolated[offset + 2] = data[offset + 2];
    isolated[offset + 3] = data[offset + 3];
  }

  const bbox = getAlphaBbox(isolated, info.width, info.height);
  if (!bbox) return;

  const maxRenderSize = 760;
  const extracted = await sharp(isolated, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .extract({
      left: bbox.minX,
      top: bbox.minY,
      width: bbox.width,
      height: bbox.height,
    })
    .resize(maxRenderSize, maxRenderSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const extractedMeta = await sharp(extracted).metadata();
  const renderWidth = extractedMeta.width ?? bbox.width;
  const renderHeight = extractedMeta.height ?? bbox.height;
  const left = Math.round((info.width - renderWidth) / 2);
  const top = Math.round(info.height - renderHeight - 96);

  const fileName = path.basename(filePath);
  const outputPath = path.join(NORMALIZED_DIR, fileName);

  await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: extracted, left, top }])
    .webp({ quality: 100 })
    .toFile(outputPath);
}

async function main() {
  await fs.mkdir(NORMALIZED_DIR, { recursive: true });
  const files = await fs.readdir(GENERATED_DIR);
  const cropFiles = files.filter((file) => CROP_SUFFIXES.some((suffix) => file.endsWith(suffix)));
  for (const file of cropFiles) {
    await normalizeCropFile(path.join(GENERATED_DIR, file));
    process.stdout.write(`normalized ${file}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
