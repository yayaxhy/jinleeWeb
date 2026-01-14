import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export const runtime = 'nodejs';

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif']);
const TARGET_DIR = path.join(process.cwd(), 'public', 'gift-wall');

const ensureAdmin = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return false;
  }
  return true;
};

const toBuffer = async (file: File) => Buffer.from(await file.arrayBuffer());

const resolveFileName = (giftName: string, ext: string) => {
  const hash = crypto.createHash('sha1').update(giftName).digest('hex').slice(0, 12);
  return `gift_${hash}${ext}`;
};

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const giftNameRaw = formData.get('giftName');
  const file = formData.get('file');

  const giftName = typeof giftNameRaw === 'string' ? giftNameRaw.trim() : '';
  if (!giftName) {
    return NextResponse.json({ error: '缺少礼物名' }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: '请上传图片文件' }, { status: 400 });
  }

  const gift = await prisma.gift.findUnique({
    where: { GiftName: giftName },
    select: { GiftName: true, giftImage: { select: { fileName: true } } },
  });
  if (!gift) {
    return NextResponse.json({ error: '未找到该礼物' }, { status: 404 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: `不支持的文件类型：${ext}` }, { status: 400 });
  }

  await fs.mkdir(TARGET_DIR, { recursive: true });

  const fileName = resolveFileName(giftName, ext);
  const targetPath = path.join(TARGET_DIR, fileName);
  await fs.writeFile(targetPath, await toBuffer(file));

  await prisma.giftImage.upsert({
    where: { giftName },
    create: { giftName, fileName },
    update: { fileName, uploadedAt: new Date() },
  });

  if (gift.giftImage?.fileName && gift.giftImage.fileName !== fileName) {
    const oldPath = path.join(TARGET_DIR, gift.giftImage.fileName);
    await fs.unlink(oldPath).catch(() => {});
  }

  return NextResponse.json({ ok: true, imageUrl: `/gift-wall/${fileName}` });
}
