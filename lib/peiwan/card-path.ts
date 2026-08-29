import fs from 'node:fs';
import path from 'node:path';

const CARD_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const CARD_DIRECTORY = path.join(process.cwd(), 'public', 'peiwanList', 'img');

export type PeiwanCardAsset = {
  publicPath: string;
  updatedAt: Date;
};

const toPublicPath = (fileName: string) => `/peiwanList/img/${encodeURIComponent(fileName)}`;

export function findPeiwanCardPath(peiwanId: number) {
  for (const extension of CARD_EXTENSIONS) {
    const fileName = `${peiwanId}.${extension}`;
    if (fs.existsSync(path.join(CARD_DIRECTORY, fileName))) {
      return toPublicPath(fileName);
    }
  }
  return null;
}

export async function readPeiwanCardPaths() {
  const assets = await readPeiwanCardAssets();
  return new Map([...assets].map(([peiwanId, asset]) => [peiwanId, asset.publicPath]));
}

export async function readPeiwanCardAssets() {
  const cardAssets = new Map<number, PeiwanCardAsset>();

  try {
    const fileNames = await fs.promises.readdir(CARD_DIRECTORY);
    for (const extension of CARD_EXTENSIONS) {
      for (const fileName of fileNames) {
        const match = fileName.match(new RegExp(`^(\\d+)\\.${extension}$`, 'i'));
        if (!match) continue;
        const peiwanId = Number(match[1]);
        if (cardAssets.has(peiwanId)) continue;

        const stats = await fs.promises.stat(path.join(CARD_DIRECTORY, fileName));
        cardAssets.set(peiwanId, {
          publicPath: toPublicPath(fileName),
          updatedAt: stats.mtime,
        });
      }
    }
  } catch {
    return cardAssets;
  }

  return cardAssets;
}
