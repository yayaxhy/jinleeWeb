import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import {
  defaultNewHomeContentDocument,
  type NewHomeContentDocument,
} from '@/app/newhome/content';

const CONTENT_DIRECTORY = path.join(process.cwd(), 'data');
const CONTENT_FILE = path.join(CONTENT_DIRECTORY, 'newhome-content.json');

function cloneDefaultDocument(): NewHomeContentDocument {
  return JSON.parse(JSON.stringify(defaultNewHomeContentDocument)) as NewHomeContentDocument;
}

function isDocumentShape(value: unknown): value is NewHomeContentDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    !!candidate.newHomeContent &&
    typeof candidate.newHomeContent === 'object' &&
    !!candidate.newHome404Content &&
    typeof candidate.newHome404Content === 'object'
  );
}

export function serializeNewHomeContentDocument(document: NewHomeContentDocument) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export async function readNewHomeContentDocument() {
  try {
    const raw = await readFile(CONTENT_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isDocumentShape(parsed)) {
      return cloneDefaultDocument();
    }

    return parsed;
  } catch {
    return cloneDefaultDocument();
  }
}

export async function writeNewHomeContentDocument(document: NewHomeContentDocument) {
  await mkdir(CONTENT_DIRECTORY, { recursive: true });
  await writeFile(CONTENT_FILE, serializeNewHomeContentDocument(document), 'utf8');
}

export async function readNewHomeContentEditorPayload() {
  const document = await readNewHomeContentDocument();

  return {
    document,
    raw: serializeNewHomeContentDocument(document),
    defaultRaw: serializeNewHomeContentDocument(defaultNewHomeContentDocument),
    contentPath: CONTENT_FILE,
  };
}
