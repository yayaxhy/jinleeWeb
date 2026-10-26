
import { SiteText } from "@/components/SiteCopyProvider";
import { migrationModelLabel, migrationDispositionLabel, migrationRolesLabel } from '@/lib/account-migration-labels';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { accountMigrationHistoryOwners, PRIVATE_MIGRATION_ARCHIVE_MODELS } from '@/lib/account-migration-history';
export default async function MigrationHistoryPage({ searchParams }: { searchParams: Promise<{ requestId?: string; cursor?: string }> }) {
  const session = await getServerSession(); if (!session?.dlmId) redirect('/');
  const owners = await accountMigrationHistoryOwners(prisma, session.dlmId);
  const { requestId, cursor } = await searchParams;
  const migrations = await prisma.accountMigration.findMany({ where: { targetDlmId: { in: owners } }, orderBy: { createdAt: 'desc' },
    select: { id: true, sourceDlmId: true, targetDlmId: true, createdAt: true, rolesStatus: true } });
  const selected = migrations.find(row => row.id === requestId);
  const validCursor = selected && cursor ? await prisma.accountMigrationArchive.findFirst({ where: { id: cursor, migrationId: selected.id } }) : null;
  const archives = selected ? await prisma.accountMigrationArchive.findMany({ where: { migrationId: selected.id, model: { notIn: PRIVATE_MIGRATION_ARCHIVE_MODELS } }, orderBy: { id: 'asc' }, take: 51,
    ...(validCursor ? { cursor: { id: validCursor.id }, skip: 1 } : {}) }) : [];
  return <main className="mx-auto max-w-5xl space-y-5 p-6"><h1 className="text-2xl font-semibold"><SiteText copyKey="site.app.profile.account.migrations.page.54ecbdefc114" /></h1>
    <Link href="/profile" className="underline"><SiteText copyKey="site.app.profile.account.migrations.page.4ab3251af877" /></Link>
    {migrations.length === 0 && <p><SiteText copyKey="site.app.profile.account.migrations.page.113413a04995" /></p>}
    <ul className="space-y-2">{migrations.map(row => <li key={row.id} className="break-words rounded border p-3"><Link className="underline" href={`/profile/account-migrations?requestId=${encodeURIComponent(row.id)}`}>{row.sourceDlmId} → {row.targetDlmId} · {row.createdAt.toISOString()}</Link><p><SiteText copyKey="site.app.profile.account.migrations.page.564363fdde27" />{row.id}<SiteText copyKey="site.app.profile.account.migrations.page.29fde0ce8b7e" /><SiteText namespace="site.lib.account.migration.labels" value={migrationRolesLabel(row.rolesStatus)} /></p></li>)}</ul>
    {archives.slice(0, 50).map(row => <details key={row.id} className="rounded border p-3"><summary className="break-all"><SiteText namespace="site.lib.account.migration.labels" value={migrationModelLabel(row.model)} /> · <SiteText namespace="site.lib.account.migration.labels" value={migrationDispositionLabel(row.disposition)} /></summary><pre className="mt-3 max-w-full overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(row.payload, null, 2)}</pre></details>)}
    {selected && archives.length > 50 && <Link className="underline" href={`/profile/account-migrations?requestId=${encodeURIComponent(selected.id)}&cursor=${encodeURIComponent(archives[49].id)}`}><SiteText copyKey="site.app.profile.account.migrations.page.f3ee9186ea52" /></Link>}
  </main>;
}
