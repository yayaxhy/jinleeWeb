import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

export const runtime = 'nodejs';

const TARGET_DIR = path.join(process.cwd(), 'public', 'wechat-avatars');
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const toBuffer = async (file: File) => Buffer.from(await file.arrayBuffer());

const resolveExtension = (file: File) => {
  const nameExtension = path.extname(file.name || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(nameExtension)) {
    return nameExtension;
  }

  switch ((file.type || '').toLowerCase()) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
};

const buildFileName = (jinleeId: string, buffer: Buffer, extension: string) => {
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
  return `wechat_${jinleeId}_${hash}${extension}`;
};

const resolveManagedFileName = (avatarUrl?: string | null) => {
  if (!avatarUrl) {
    return '';
  }

  try {
    const parsed = new URL(avatarUrl);
    if (!parsed.pathname.startsWith('/wechat-avatars/')) {
      return '';
    }

    return path.basename(parsed.pathname);
  } catch (error) {
    if (!avatarUrl.startsWith('/wechat-avatars/')) {
      return '';
    }

    return path.basename(avatarUrl);
  }
};

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const avatar = formData.get('avatar');

  if (!(avatar instanceof File) || avatar.size === 0) {
    return NextResponse.json({ ok: false, error: 'missing_avatar' }, { status: 400 });
  }

  if (avatar.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: 'avatar_too_large' }, { status: 400 });
  }

  const extension = resolveExtension(avatar);
  if (!extension) {
    return NextResponse.json({ ok: false, error: 'avatar_type_invalid' }, { status: 400 });
  }

  const buffer = await toBuffer(avatar);
  const fileName = buildFileName(currentUser.jinleeId, buffer, extension);
  const targetPath = path.join(TARGET_DIR, fileName);

  await fs.mkdir(TARGET_DIR, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const avatarPath = `/wechat-avatars/${fileName}`;
  const avatarUrl = new URL(avatarPath, request.url).toString();
  const previousFileName = resolveManagedFileName(currentUser.jinleeUser.wechatAvatarUrl);

  await prisma.jinleeUser.update({
    where: { jinleeId: currentUser.jinleeId },
    data: {
      wechatAvatarUrl: avatarPath,
    },
  });

  if (previousFileName && previousFileName !== fileName) {
    await fs.unlink(path.join(TARGET_DIR, previousFileName)).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    avatarPath,
    avatarUrl,
  });
}
