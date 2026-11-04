import { NextResponse } from 'next/server';
import { canManagePointShop } from '@/lib/admin';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PointShopAdminError, readPointShopAdmin, savePointShopAdmin } from '@/lib/point-shop-admin';
import { CopyImageStorageError } from '@/lib/editable-copy-image-storage';
import { copyImageFailureMessage } from '@/lib/editable-copy-image-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorized() {
  const session = await getServerSession();
  return canManagePointShop(session?.discordId);
}
function failure(error: unknown) {
  if (error instanceof CopyImageStorageError) return NextResponse.json({ error: copyImageFailureMessage(error.code) }, { status: 400 });
  if (error instanceof PointShopAdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  if ((error as { code?: string })?.code === 'P2034') {
    return NextResponse.json({ error: '该券已被修改，请刷新后重试' }, { status: 409 });
  }
  console.error('[admin/point-shop]', error);
  return NextResponse.json({ error: '操作失败，请重试' }, { status: 503 });
}
export async function GET() {
  if (!await authorized()) return NextResponse.json({ error: '操作失败，请重试' }, { status: 403 });
  try { return NextResponse.json(await readPointShopAdmin(prisma), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}
async function write(request: Request, create: boolean) {
  if (!await authorized()) return NextResponse.json({ error: '操作失败，请重试' }, { status: 403 });
  try {
    await savePointShopAdmin(prisma, await request.json().catch(() => null), create);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
export const POST = (request: Request) => write(request, true);
export const PATCH = (request: Request) => write(request, false);
