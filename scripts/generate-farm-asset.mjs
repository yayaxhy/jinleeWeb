import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { FARM_ASSET_PROMPTS, FARM_CORE_ASSET_KEYS } from './farm-asset-prompts.mjs';

const OPENAI_GENERATE_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'farm', 'generated');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs(argv) {
  const args = {
    key: null,
    allCore: false,
    model: 'gpt-image-1',
    size: null,
    quality: null,
    background: 'transparent',
    outputFormat: 'webp',
    editFrom: null,
    inputFidelity: null,
  };

  for (const token of argv) {
    if (token === '--all-core') args.allCore = true;
    else if (token.startsWith('--model=')) args.model = token.slice('--model='.length);
    else if (token.startsWith('--size=')) args.size = token.slice('--size='.length);
    else if (token.startsWith('--quality=')) args.quality = token.slice('--quality='.length);
    else if (token.startsWith('--background=')) args.background = token.slice('--background='.length);
    else if (token.startsWith('--format=')) args.outputFormat = token.slice('--format='.length);
    else if (token.startsWith('--edit-from=')) args.editFrom = token.slice('--edit-from='.length);
    else if (token.startsWith('--input-fidelity=')) args.inputFidelity = token.slice('--input-fidelity='.length);
    else if (!token.startsWith('--') && !args.key) args.key = token;
  }

  return args;
}

async function resolveEditReference({ cliValue, promptConfig }) {
  const candidate = cliValue ?? promptConfig.editReferenceFileName;
  if (!candidate) return null;

  const resolvedPath = path.isAbsolute(candidate)
    ? candidate
    : cliValue
      ? path.resolve(process.cwd(), candidate)
      : path.join(OUTPUT_DIR, candidate);

  await fs.access(resolvedPath);
  return resolvedPath;
}

async function requestGeneratedImage({ apiKey, body }) {
  const response = await fetch(OPENAI_GENERATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? response.statusText);
  }

  return payload;
}

async function prepareEditReferencePng(editFrom) {
  const image = sharp(editFrom);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;

  if (width === height) {
    return image.png().toBuffer();
  }

  const side = Math.max(width, height);
  return image
    .resize(side, side, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function getPixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

async function getImageRaw(input) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function normalizeEditedPlotAsset({ outputPath, referencePath }) {
  const edited = await getImageRaw(outputPath);
  const reference = await getImageRaw(referencePath);
  if (edited.info.width !== reference.info.width || edited.info.height !== reference.info.height) {
    return;
  }

  const masked = Buffer.from(edited.data);
  for (let y = 0; y < edited.info.height; y += 1) {
    for (let x = 0; x < edited.info.width; x += 1) {
      const offset = getPixelOffset(edited.info.width, x, y);
      masked[offset + 3] = reference.data[offset + 3];
    }
  }

  const bbox = getAlphaBbox(masked, edited.info.width, edited.info.height);
  if (!bbox) {
    return;
  }

  const normalized = await sharp(masked, {
    raw: {
      width: edited.info.width,
      height: edited.info.height,
      channels: 4,
    },
  })
    .extract({
      left: bbox.minX,
      top: bbox.minY,
      width: bbox.width,
      height: bbox.height,
    })
    .extend({
      top: bbox.minY,
      left: bbox.minX,
      right: edited.info.width - bbox.maxX - 1,
      bottom: edited.info.height - bbox.maxY - 1,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp()
    .toBuffer();

  await fs.writeFile(outputPath, normalized);
}

async function requestEditedImage({ apiKey, promptConfig, model, size, quality, background, outputFormat, editFrom, inputFidelity }) {
  const editModel = model === 'dall-e-2' ? model : 'dall-e-2';
  const form = new FormData();
  form.append('model', editModel);
  form.append('prompt', promptConfig.prompt);
  form.append('size', size ?? promptConfig.size);
  form.append('response_format', 'b64_json');

  const sourceBuffer = await prepareEditReferencePng(editFrom);
  form.append('image', new Blob([sourceBuffer], { type: 'image/png' }), `${path.parse(editFrom).name}.png`);

  const response = await fetch(OPENAI_EDIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? response.statusText);
  }

  return payload;
}

async function generateAsset({ key, model, size, quality, background, outputFormat, editFrom, inputFidelity }) {
  const promptConfig = FARM_ASSET_PROMPTS[key];
  if (!promptConfig) {
    throw new Error(`Unknown asset key: ${key}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY. Put it in your local environment before running this script.');
  }

  const resolvedEditReference = await resolveEditReference({ cliValue: editFrom, promptConfig }).catch(() => {
    if (editFrom) {
      throw new Error(`Edit reference not found: ${editFrom}`);
    }
    if (promptConfig.editReferenceFileName) {
      throw new Error(`Default edit reference not found for ${key}: ${promptConfig.editReferenceFileName}`);
    }
    return null;
  });

  let payload;
  if (resolvedEditReference) {
    payload = await requestEditedImage({
      apiKey,
      promptConfig,
      model,
      size,
      quality,
      background,
      outputFormat,
      editFrom: resolvedEditReference,
      inputFidelity,
    }).catch((error) => {
      throw new Error(`OpenAI image edit failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    });
  } else {
    const body = {
      model,
      prompt: promptConfig.prompt,
      size: size ?? promptConfig.size,
      quality: quality ?? promptConfig.quality,
      output_format: outputFormat,
      background,
    };

    payload = await requestGeneratedImage({ apiKey, body }).catch((error) => {
      throw new Error(`OpenAI image generation failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  const image = payload?.data?.[0]?.b64_json;
  const imageUrl = payload?.data?.[0]?.url;
  if (!image && !imageUrl) {
    throw new Error(`OpenAI image request returned no image data for ${key}`);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, promptConfig.fileName);
  if (image) {
    await fs.writeFile(outputPath, Buffer.from(image, 'base64'));
  } else {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image for ${key}: ${imageResponse.statusText}`);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  }

  if (resolvedEditReference) {
    await normalizeEditedPlotAsset({
      outputPath,
      referencePath: resolvedEditReference,
    });
  }

  return outputPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const keys = args.allCore ? FARM_CORE_ASSET_KEYS : args.key ? [args.key] : [];

  if (keys.length === 0) {
    console.error('Usage: npm run farm:generate -- <asset-key> [--model=gpt-image-1] [--size=1024x1024] [--quality=medium] [--edit-from=path/to/reference.webp]');
    console.error('   or: npm run farm:generate:all-core');
    console.error(`Available asset keys: ${Object.keys(FARM_ASSET_PROMPTS).join(', ')}`);
    process.exit(1);
  }

  for (const key of keys) {
    process.stdout.write(`Generating ${key}... `);
    const outputPath = await generateAsset({
      key,
      model: args.model,
      size: args.size,
      quality: args.quality,
      background: args.background,
      outputFormat: args.outputFormat,
      editFrom: args.editFrom,
      inputFidelity: args.inputFidelity,
    });
    process.stdout.write(`saved to ${outputPath}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
