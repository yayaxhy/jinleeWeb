import path from 'path';
import { NextResponse } from 'next/server';
import {
  buildVoicePreviewAudioResponse,
  sanitizeVoicePreviewFilename,
  VOICE_PREVIEW_TARGET_DIR,
} from '@/lib/voice-preview-file';

export const runtime = 'nodejs';

type RouteParams = {
  fileName: string;
};

const buildPublicVoicePreviewResponse = async (
  request: Request,
  context: { params: Promise<RouteParams> },
  includeBody: boolean,
) => {
  const { fileName } = await context.params;
  const safeFileName = sanitizeVoicePreviewFilename(fileName);
  if (!safeFileName || safeFileName !== fileName) {
    return NextResponse.json({ error: '试音文件不存在' }, { status: 404 });
  }

  const filePath = path.join(VOICE_PREVIEW_TARGET_DIR, safeFileName);
  return await buildVoicePreviewAudioResponse(request, filePath, safeFileName, includeBody);
};

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  try {
    return await buildPublicVoicePreviewResponse(request, context, true);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: '试音文件不存在' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : '读取试音失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function HEAD(request: Request, context: { params: Promise<RouteParams> }) {
  try {
    return await buildPublicVoicePreviewResponse(request, context, false);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 500 });
  }
}
