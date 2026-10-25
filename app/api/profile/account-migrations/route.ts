import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { accountMigrationHistoryOwners, PRIVATE_MIGRATION_ARCHIVE_MODELS } from '@/lib/account-migration-history';
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.dlmId) return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.account.migrations.route.a323ce0e3b6d") }, { status: 401 });
  const owners = await accountMigrationHistoryOwners(prisma, session.dlmId);
  const requestId = request.nextUrl.searchParams.get('requestId');
  if (!requestId) {
    const records = await prisma.accountMigration.findMany({ where: { targetDlmId: { in: owners } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, mode: true, sourceDlmId: true, targetDlmId: true, result: true, rolesStatus: true, rolesError: true, createdAt: true } });
    return NextResponse.json({ records }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const migration = await prisma.accountMigration.findFirst({ where: { id: requestId, targetDlmId: { in: owners } }, select: { id: true } });
  if (!migration) return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.account.migrations.route.4349e2c2af16") }, { status: 404 });
  const cursor = request.nextUrl.searchParams.get('cursor');
  if (cursor && !await prisma.accountMigrationArchive.findFirst({ where: { id: cursor, migrationId: requestId, model: { notIn: PRIVATE_MIGRATION_ARCHIVE_MODELS } } })) return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.account.migrations.route.532b812a99bc") }, { status: 400 });
  const rows = await prisma.accountMigrationArchive.findMany({ where: { migrationId: requestId, model: { notIn: PRIVATE_MIGRATION_ARCHIVE_MODELS } },
    orderBy: { id: 'asc' }, take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, model: true, recordKey: true, disposition: true, payload: true, createdAt: true } });
  return NextResponse.json({ records: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null }, { headers: { 'Cache-Control': 'no-store' } });
}
