import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export const runtime = 'nodejs';

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg']);
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

const normalizeCategory = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : '默认';
};

const parsePrice = (raw: string, required: boolean) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return required ? { error: '请填写礼物价格' } : { price: null };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { error: '礼物价格必须大于 0' };
  }
  return { price: new Prisma.Decimal(trimmed) };
};

const serializeGift = (gift: { GiftName: string; price: Prisma.Decimal | null; active: boolean }, image: {
  fileName: string;
  category: string;
} | null) => ({
  name: gift.GiftName,
  price: gift.price?.toString() ?? '',
  active: gift.active,
  category: image?.category ?? '默认',
  imageUrl: image?.fileName ? `/gift-wall/${image.fileName}` : null,
});

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const giftNameRaw = formData.get('giftName');
  const priceRaw = formData.get('price');
  const categoryRaw = formData.get('category');
  const activeRaw = formData.get('active');
  const file = formData.get('file');

  const giftName = typeof giftNameRaw === 'string' ? giftNameRaw.trim() : '';
  if (!giftName) {
    return NextResponse.json({ error: '缺少礼物名' }, { status: 400 });
  }

  const priceValue = typeof priceRaw === 'string' ? parsePrice(priceRaw, true) : { error: '请填写礼物价格' };
  if ('error' in priceValue) {
    return NextResponse.json({ error: priceValue.error }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: '请上传图片文件' }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: `不支持的文件类型：${ext}` }, { status: 400 });
  }

  const existing = await prisma.gift.findUnique({
    where: { GiftName: giftName },
    select: { GiftName: true },
  });
  if (existing) {
    return NextResponse.json({ error: '礼物已存在' }, { status: 409 });
  }

  await fs.mkdir(TARGET_DIR, { recursive: true });
  const fileName = resolveFileName(giftName, ext);
  const targetPath = path.join(TARGET_DIR, fileName);
  await fs.writeFile(targetPath, await toBuffer(file));

  const active =
    typeof activeRaw === 'string' ? activeRaw === 'true' || activeRaw === '1' || activeRaw === 'on' : true;
  const category =
    typeof categoryRaw === 'string' ? normalizeCategory(categoryRaw) : '默认';

  const gift = await prisma.gift.create({
    data: {
      GiftName: giftName,
      price: priceValue.price,
      active,
    },
  });
  const giftImage = await prisma.giftImage.create({
    data: { giftName, fileName, category },
  });

  return NextResponse.json({ ok: true, gift: serializeGift(gift, giftImage) });
}

export async function PATCH(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const giftNameRaw = formData.get('giftName');
  const priceRaw = formData.get('price');
  const categoryRaw = formData.get('category');
  const activeRaw = formData.get('active');
  const file = formData.get('file');

  const giftName = typeof giftNameRaw === 'string' ? giftNameRaw.trim() : '';
  if (!giftName) {
    return NextResponse.json({ error: '缺少礼物名' }, { status: 400 });
  }

  const existing = await prisma.gift.findUnique({
    where: { GiftName: giftName },
    include: { giftImage: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '未找到该礼物' }, { status: 404 });
  }

  const updates: Prisma.GiftUpdateInput = {};
  if (typeof priceRaw === 'string') {
    const parsed = parsePrice(priceRaw, false);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.price) {
      updates.price = parsed.price;
    }
  }

  if (typeof activeRaw === 'string') {
    updates.active = activeRaw === 'true' || activeRaw === '1' || activeRaw === 'on';
  }

  let gift = existing;
  if (Object.keys(updates).length) {
    gift = await prisma.gift.update({
      where: { GiftName: giftName },
      data: updates,
      include: { giftImage: true },
    });
  }

  let updatedImage = gift.giftImage;
  const hasFile = file instanceof File && file.size > 0;
  const categoryProvided = typeof categoryRaw === 'string';
  const nextCategory = categoryProvided ? normalizeCategory(categoryRaw) : updatedImage?.category ?? '默认';

  if (hasFile) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `不支持的文件类型：${ext}` }, { status: 400 });
    }

    await fs.mkdir(TARGET_DIR, { recursive: true });
    const fileName = resolveFileName(giftName, ext);
    const targetPath = path.join(TARGET_DIR, fileName);
    await fs.writeFile(targetPath, await toBuffer(file));

    updatedImage = await prisma.giftImage.upsert({
      where: { giftName },
      create: { giftName, fileName, category: nextCategory },
      update: { fileName, category: nextCategory, uploadedAt: new Date() },
    });

    if (gift.giftImage?.fileName && gift.giftImage.fileName !== fileName) {
      const oldPath = path.join(TARGET_DIR, gift.giftImage.fileName);
      await fs.unlink(oldPath).catch(() => {});
    }
  } else if (categoryProvided && updatedImage) {
    updatedImage = await prisma.giftImage.update({
      where: { giftName },
      data: { category: nextCategory },
    });
  }

  return NextResponse.json({ ok: true, gift: serializeGift(gift, updatedImage) });
}
