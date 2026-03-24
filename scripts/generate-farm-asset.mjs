import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { FARM_ASSET_PROMPTS, FARM_CORE_ASSET_KEYS } from './farm-asset-prompts.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/images/generations';
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
  };

  for (const token of argv) {
    if (token === '--all-core') args.allCore = true;
    else if (token.startsWith('--model=')) args.model = token.slice('--model='.length);
    else if (token.startsWith('--size=')) args.size = token.slice('--size='.length);
    else if (token.startsWith('--quality=')) args.quality = token.slice('--quality='.length);
    else if (token.startsWith('--background=')) args.background = token.slice('--background='.length);
    else if (token.startsWith('--format=')) args.outputFormat = token.slice('--format='.length);
    else if (!token.startsWith('--') && !args.key) args.key = token;
  }

  return args;
}

async function generateAsset({ key, model, size, quality, background, outputFormat }) {
  const promptConfig = FARM_ASSET_PROMPTS[key];
  if (!promptConfig) {
    throw new Error(`Unknown asset key: ${key}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY. Put it in your local environment before running this script.');
  }

  const body = {
    model,
    prompt: promptConfig.prompt,
    size: size ?? promptConfig.size,
    quality: quality ?? promptConfig.quality,
    output_format: outputFormat,
    background,
  };

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI image generation failed for ${key}: ${payload?.error?.message ?? response.statusText}`);
  }

  const image = payload?.data?.[0]?.b64_json;
  if (!image) {
    throw new Error(`OpenAI image generation returned no image data for ${key}`);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, promptConfig.fileName);
  await fs.writeFile(outputPath, Buffer.from(image, 'base64'));
  return outputPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const keys = args.allCore ? FARM_CORE_ASSET_KEYS : args.key ? [args.key] : [];

  if (keys.length === 0) {
    console.error('Usage: npm run farm:generate -- <asset-key> [--model=gpt-image-1] [--size=1024x1024] [--quality=medium]');
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
    });
    process.stdout.write(`saved to ${outputPath}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
