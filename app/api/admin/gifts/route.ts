import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canManageGifts } from '@/lib/admin';

export const runtime = 'nodejs';

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif']);
const TARGET_DIR = path.join(process.cwd(), 'public', 'gift-wall');

const ensureGiftAdmin = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGifts(session.discordId)) {
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

const parseRate = (raw: string, required: boolean) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return required ? { error: '请填写 rate' } : { rate: null };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { error: 'rate 必须为 0 或正数' };
  }
  return { rate: new Prisma.Decimal(trimmed) };
};

const serializeGift = (
  gift: {
    GiftName: string;
    price: Prisma.Decimal | null;
    url_link: string | null;
    rate: Prisma.Decimal | null;
    active: boolean;
    staffOnlyGift: boolean;
  },
  image: {
  fileName: string;
  category: string;
} | null) => ({
  name: gift.GiftName,
  price: gift.price?.toString() ?? '',
  urlLink: gift.url_link ?? '',
  rate: gift.rate?.toString() ?? '',
  active: gift.active,
  staffOnlyGift: gift.staffOnlyGift,
  category: image?.category ?? '默认',
  imageUrl: image?.fileName ? `/gift-wall/${image.fileName}` : null,
});

export async function POST(request: NextRequest) {
  if (!(await ensureGiftAdmin())) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const giftNameRaw = formData.get('giftName');
  const priceRaw = formData.get('price');
  const urlLinkRaw = formData.get('urlLink');
  const rateRaw = formData.get('rate');
  const categoryRaw = formData.get('category');
  const activeRaw = formData.get('active');
  const staffOnlyGiftRaw = formData.get('staffOnlyGift');
  const file = formData.get('file');

  const giftName = typeof giftNameRaw === 'string' ? giftNameRaw.trim() : '';
  if (!giftName) {
    return NextResponse.json({ error: '缺少礼物名' }, { status: 400 });
  }

  const priceValue = typeof priceRaw === 'string' ? parsePrice(priceRaw, true) : { error: '请填写礼物价格' };
  if ('error' in priceValue) {
    return NextResponse.json({ error: priceValue.error }, { status: 400 });
  }

  const rateValue = typeof rateRaw === 'string' ? parseRate(rateRaw, false) : { rate: null };
  if ('error' in rateValue) {
    return NextResponse.json({ error: rateValue.error }, { status: 400 });
  }

  const hasFile = file instanceof File && file.size > 0;

  const existing = await prisma.gift.findUnique({
    where: { GiftName: giftName },
    select: { GiftName: true },
  });
  if (existing) {
    return NextResponse.json({ error: '礼物已存在' }, { status: 409 });
  }

  let fileName = '';
  if (hasFile) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `不支持的文件类型：${ext}` }, { status: 400 });
    }
    await fs.mkdir(TARGET_DIR, { recursive: true });
    fileName = resolveFileName(giftName, ext);
    const targetPath = path.join(TARGET_DIR, fileName);
    await fs.writeFile(targetPath, await toBuffer(file));
  }

  const active =
    typeof activeRaw === 'string' ? activeRaw === 'true' || activeRaw === '1' || activeRaw === 'on' : true;
  const staffOnlyGift =
    typeof staffOnlyGiftRaw === 'string'
      ? staffOnlyGiftRaw === 'true' || staffOnlyGiftRaw === '1' || staffOnlyGiftRaw === 'on'
      : false;
  const category =
    typeof categoryRaw === 'string' ? normalizeCategory(categoryRaw) : '默认';
  const urlLink = typeof urlLinkRaw === 'string' ? urlLinkRaw.trim() : '';

  const gift = await prisma.gift.create({
    data: {
      GiftName: giftName,
      price: priceValue.price,
      url_link: urlLink ? urlLink : null,
      rate: rateValue.rate ?? undefined,
      active,
      staffOnlyGift,
    },
  });
  const giftImage = await prisma.giftImage.create({
    data: { giftName, fileName, category },
  });

  return NextResponse.json({ ok: true, gift: serializeGift(gift, giftImage) });
}

export async function PATCH(request: NextRequest) {
  if (!(await ensureGiftAdmin())) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const giftNameRaw = formData.get('giftName');
  const priceRaw = formData.get('price');
  const urlLinkRaw = formData.get('urlLink');
  const rateRaw = formData.get('rate');
  const categoryRaw = formData.get('category');
  const activeRaw = formData.get('active');
  const staffOnlyGiftRaw = formData.get('staffOnlyGift');
  const newGiftNameRaw = formData.get('newGiftName');
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

  const newGiftName =
    typeof newGiftNameRaw === 'string' ? newGiftNameRaw.trim() : '';
  const renameTarget = newGiftName && newGiftName !== giftName ? newGiftName : null;
  if (renameTarget) {
    const duplicate = await prisma.gift.findUnique({
      where: { GiftName: renameTarget },
      select: { GiftName: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: '礼物名已存在' }, { status: 409 });
    }
  }

  const updates: Prisma.GiftUpdateInput = {};
  if (renameTarget) {
    updates.GiftName = renameTarget;
  }
  if (typeof priceRaw === 'string') {
    const parsed = parsePrice(priceRaw, false);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.price) {
      updates.price = parsed.price;
    }
  }

  if (typeof urlLinkRaw === 'string') {
    const trimmed = urlLinkRaw.trim();
    updates.url_link = trimmed ? trimmed : null;
  }

  if (typeof rateRaw === 'string') {
    const parsed = parseRate(rateRaw, false);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.rate) {
      updates.rate = parsed.rate;
    }
  }

  if (typeof activeRaw === 'string') {
    updates.active = activeRaw === 'true' || activeRaw === '1' || activeRaw === 'on';
  }

  if (typeof staffOnlyGiftRaw === 'string') {
    updates.staffOnlyGift = staffOnlyGiftRaw === 'true' || staffOnlyGiftRaw === '1' || staffOnlyGiftRaw === 'on';
  }

  let gift = existing;
  if (Object.keys(updates).length) {
    gift = await prisma.gift.update({
      where: { GiftName: giftName },
      data: updates,
      include: { giftImage: true },
    });
  }

  if (renameTarget) {
    await prisma.giftAudit.updateMany({
      where: { giftName },
      data: { giftName: gift.GiftName },
    });
  }

  let updatedImage = gift.giftImage;
  const targetGiftName = gift.GiftName;
  const hasFile = file instanceof File && file.size > 0;
  const categoryProvided = typeof categoryRaw === 'string';
  const nextCategory = categoryProvided ? normalizeCategory(categoryRaw) : updatedImage?.category ?? '默认';

  if (hasFile) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `不支持的文件类型：${ext}` }, { status: 400 });
    }

    await fs.mkdir(TARGET_DIR, { recursive: true });
    const fileName = resolveFileName(targetGiftName, ext);
    const targetPath = path.join(TARGET_DIR, fileName);
    await fs.writeFile(targetPath, await toBuffer(file));

    updatedImage = await prisma.giftImage.upsert({
      where: { giftName: targetGiftName },
      create: { giftName: targetGiftName, fileName, category: nextCategory },
      update: { fileName, category: nextCategory, uploadedAt: new Date() },
    });

    if (gift.giftImage?.fileName && gift.giftImage.fileName !== fileName) {
      const oldPath = path.join(TARGET_DIR, gift.giftImage.fileName);
      await fs.unlink(oldPath).catch(() => {});
    }
  } else if (categoryProvided && updatedImage) {
    updatedImage = await prisma.giftImage.update({
      where: { giftName: targetGiftName },
      data: { category: nextCategory },
    });
  }

  return NextResponse.json({ ok: true, gift: serializeGift(gift, updatedImage) });
}
