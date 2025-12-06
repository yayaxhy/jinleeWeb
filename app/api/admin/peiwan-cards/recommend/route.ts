import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isAdminDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const TARGET_DIR = path.join(process.cwd(), 'public', 'peiwanRecommend');
const MAX_FILES = 8;

const ensureAdmin = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return false;
  }
  return true;
};

const toBuffer = async (file: File) => Buffer.from(await file.arrayBuffer());

const normalizeFileName = (name: string) => {
  const base = path.basename(name);
  if (!base) return null;
  return base.replace(/\s+/g, '_');
};

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files').flatMap((entry) => (entry instanceof File && entry.size > 0 ? [entry] : []));

  if (files.length === 0) {
    return NextResponse.json({ error: '请至少上传 1 个文件' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `最多只能上传 ${MAX_FILES} 个文件` }, { status: 400 });
  }

  await fs.mkdir(TARGET_DIR, { recursive: true });

  const existing = await fs.readdir(TARGET_DIR);
  await Promise.all(
    existing.map((name) => fs.rm(path.join(TARGET_DIR, name), { force: true, recursive: true }))
  );

  const saved: string[] = [];

  for (const file of files) {
    const fileName = normalizeFileName(file.name);
    if (!fileName) {
      return NextResponse.json({ error: '存在无法识别的文件名' }, { status: 400 });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `不支持的文件类型：${ext}` }, { status: 400 });
    }

    const target = path.join(TARGET_DIR, fileName);
    await fs.writeFile(target, await toBuffer(file));
    saved.push(fileName);
  }

  return NextResponse.json({ saved });
}
