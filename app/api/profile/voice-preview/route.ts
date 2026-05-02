import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import {
  buildVoicePreviewAudioResponse,
  resolveStoredVoicePreviewFileNameFromUrl,
  sanitizeVoicePreviewFilename,
  VOICE_PREVIEW_TARGET_DIR,
} from '@/lib/voice-preview-file';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.opus', '.wav', '.webm']);
const ALLOWED_CONTENT_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
]);
const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/m4a': '.m4a',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/x-m4a': '.m4a',
  'audio/x-wav': '.wav',
};

const normalizeContentType = (contentType?: string | null) =>
  String(contentType ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

const ensurePeiwan = async (request?: Request) => {
  const currentUser = await getCurrentJinleeUser(request);
  const discordUserId = currentUser?.discordUserId?.trim();
  if (!discordUserId) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId },
    include: {
      peiwan: true,
    },
  });
  if (!member || member.status !== 'PEIWAN' || !member.peiwan) {
    return { error: NextResponse.json({ error: '仅限陪玩上传试音' }, { status: 403 }) };
  }

  const deletionRecord = await prisma.peiwanDeletion.findUnique({
    where: { peiwanId: member.peiwan.PEIWANID },
    select: { peiwanId: true },
  });
  if (deletionRecord) {
    return { error: NextResponse.json({ error: '你的陪玩资料当前不可编辑' }, { status: 403 }) };
  }

  return {
    discordUserId,
    peiwan: member.peiwan,
  };
};

const resolveStoredFileName = (discordUserId: string, ext: string) => {
  const hash = crypto
    .createHash('sha1')
    .update(`${discordUserId}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 12);
  return `voice_${discordUserId}_${hash}${ext}`;
};

const removeStoredFile = async (params: { filename?: string | null; url?: string | null }) => {
  const candidates = new Set<string>();
  const fromFilename = sanitizeVoicePreviewFilename(params.filename);
  const fromUrl = resolveStoredVoicePreviewFileNameFromUrl(params.url);
  if (fromFilename) candidates.add(fromFilename);
  if (fromUrl) candidates.add(fromUrl);
  await Promise.all(
    [...candidates].map((candidate) => fs.unlink(path.join(VOICE_PREVIEW_TARGET_DIR, candidate)).catch(() => {})),
  );
};

export async function GET(request: Request) {
  try {
    const current = await ensurePeiwan(request);
    if ('error' in current) {
      return current.error;
    }

    const storedFileName = resolveStoredVoicePreviewFileNameFromUrl(current.peiwan.voicePreviewUrl);
    if (!storedFileName) {
      return NextResponse.json({ error: '暂无试音文件' }, { status: 404 });
    }

    const filePath = path.join(VOICE_PREVIEW_TARGET_DIR, storedFileName);
    const downloadName = sanitizeVoicePreviewFilename(current.peiwan.voicePreviewFilename) || storedFileName;
    return await buildVoicePreviewAudioResponse(request, filePath, downloadName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: '试音文件不存在' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : '读取试音失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedFileName: string | null = null;
  try {
    const current = await ensurePeiwan(request);
    if ('error' in current) {
      return current.error;
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: '请上传试音文件' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '试音文件不能超过 10MB' }, { status: 400 });
    }

    const ext = path.extname(file.name).trim().toLowerCase();
    const contentType = normalizeContentType(file.type);
    if (!ALLOWED_EXTS.has(ext) && !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: '仅支持 mp3、m4a、wav、ogg、opus、webm、flac、aac 音频文件' },
        { status: 400 },
      );
    }

    await fs.mkdir(VOICE_PREVIEW_TARGET_DIR, { recursive: true });

    const safeExt = ALLOWED_EXTS.has(ext) ? ext : CONTENT_TYPE_EXTENSION_MAP[contentType] ?? '.mp3';
    const fileName = resolveStoredFileName(current.discordUserId, safeExt);
    const originalFilename = sanitizeVoicePreviewFilename(file.name) || `voice_preview${safeExt}`;
    uploadedFileName = fileName;
    const targetPath = path.join(VOICE_PREVIEW_TARGET_DIR, fileName);
    const origin = process.env.NEXTAUTH_URL?.trim() || new URL(request.url).origin;
    const publicUrl = new URL(`/peiwan-voice-preview/${fileName}`, origin).toString();
    await fs.writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

    await prisma.pEIWAN.update({
      where: { discordUserId: current.discordUserId },
      data: {
        voicePreviewUrl: publicUrl,
        voicePreviewFilename: originalFilename,
      },
    });

    await removeStoredFile({
      filename: current.peiwan.voicePreviewFilename,
      url: current.peiwan.voicePreviewUrl,
    });

    return NextResponse.json({
      ok: true,
      voicePreviewUrl: publicUrl,
      voicePreviewFilename: originalFilename,
    });
  } catch (error) {
    if (uploadedFileName) {
      await removeStoredFile({ filename: uploadedFileName });
    }
    const message = error instanceof Error ? error.message : '上传失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const current = await ensurePeiwan(request);
    if ('error' in current) {
      return current.error;
    }

    await prisma.pEIWAN.update({
      where: { discordUserId: current.discordUserId },
      data: {
        voicePreviewUrl: null,
        voicePreviewFilename: null,
      },
    });

    await removeStoredFile({
      filename: current.peiwan.voicePreviewFilename,
      url: current.peiwan.voicePreviewUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
