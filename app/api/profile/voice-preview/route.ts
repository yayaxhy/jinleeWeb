import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { canAccessVoicePreview } from '@/lib/voice-preview-access';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TARGET_DIR = path.join(process.cwd(), 'public', 'peiwan-voice-preview');
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

const sanitizeFilename = (filename?: string | null) =>
  path.basename(String(filename ?? '').trim()).replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');

const ensurePeiwan = async (request?: Request) => {
  const currentUser = await getCurrentJinleeUser(request);
  const discordUserId = currentUser?.discordUserId?.trim();
  if (!discordUserId) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }
  if (!canAccessVoicePreview(discordUserId)) {
    return { error: NextResponse.json({ error: '试音功能当前仅对白名单测试用户开放' }, { status: 403 }) };
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

const removeStoredFile = async (filename?: string | null) => {
  const sanitized = sanitizeFilename(filename);
  if (!sanitized) return;
  await fs.unlink(path.join(TARGET_DIR, sanitized)).catch(() => {});
};

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

    await fs.mkdir(TARGET_DIR, { recursive: true });

    const safeExt = ALLOWED_EXTS.has(ext) ? ext : CONTENT_TYPE_EXTENSION_MAP[contentType] ?? '.mp3';
    const fileName = resolveStoredFileName(current.discordUserId, safeExt);
    uploadedFileName = fileName;
    const targetPath = path.join(TARGET_DIR, fileName);
    const publicUrl = new URL(`/peiwan-voice-preview/${fileName}`, request.url).toString();
    await fs.writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

    await prisma.pEIWAN.update({
      where: { discordUserId: current.discordUserId },
      data: {
        voicePreviewUrl: publicUrl,
        voicePreviewFilename: fileName,
      },
    });

    await removeStoredFile(current.peiwan.voicePreviewFilename);

    return NextResponse.json({
      ok: true,
      voicePreviewUrl: publicUrl,
      voicePreviewFilename: fileName,
    });
  } catch (error) {
    if (uploadedFileName) {
      await removeStoredFile(uploadedFileName);
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

    await removeStoredFile(current.peiwan.voicePreviewFilename);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
