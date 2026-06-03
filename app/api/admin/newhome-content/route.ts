import { NextResponse } from 'next/server';

import { isAdminDiscordId } from '@/lib/admin';
import {
  readNewHomeContentDocument,
  readNewHomeContentEditorPayload,
  writeNewHomeContentDocument,
} from '@/lib/newhome-content';
import { getServerSession } from '@/lib/session';
import type { NewHomeContentDocument } from '@/app/newhome/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getServerSession();

  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }

  return session;
}

function parseDocument(raw: string): NewHomeContentDocument {
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON root must be an object.');
  }

  const candidate = parsed as Record<string, unknown>;
  if (!candidate.newHomeContent || typeof candidate.newHomeContent !== 'object') {
    throw new Error('Missing "newHomeContent" object.');
  }

  if (!candidate.newHome404Content || typeof candidate.newHome404Content !== 'object') {
    throw new Error('Missing "newHome404Content" object.');
  }

  return parsed as NewHomeContentDocument;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await readNewHomeContentEditorPayload();
  return NextResponse.json(payload);
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { raw?: string };
    const raw = body.raw?.trim();

    if (!raw) {
      return NextResponse.json({ error: 'Missing raw JSON content.' }, { status: 400 });
    }

    const document = parseDocument(raw);
    await writeNewHomeContentDocument(document);

    return NextResponse.json({
      ok: true,
      document: await readNewHomeContentDocument(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save content.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
