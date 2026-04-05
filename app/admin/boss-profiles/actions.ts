'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/session';
import { canManageBossProfiles } from '@/lib/admin';
import { buildAndStoreBossPortrait, generateBossPortraitBatch, type BossPortraitBatchMode } from '@/lib/bossProfile';

const PAGE_PATH = '/admin/boss-profiles';

function clampSampleSize(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 20), 200);
}

function buildRedirectUrl(type: 'success' | 'error', message: string) {
  const params = new URLSearchParams({ type, message });
  return `${PAGE_PATH}?${params.toString()}`;
}

async function requireAccess() {
  const session = await getServerSession();
  if (!session?.discordId || !canManageBossProfiles(session.discordId)) {
    redirect('/');
  }
}

export async function generateSingleBossProfileAction(formData: FormData) {
  await requireAccess();

  const bossId = String(formData.get('bossId') ?? '').trim();
  const sampleSize = clampSampleSize(formData.get('sampleSize'));

  if (!/^\d+$/.test(bossId)) {
    redirect(buildRedirectUrl('error', '老板 Discord ID 格式不正确'));
  }

  const portrait = await buildAndStoreBossPortrait(bossId, sampleSize);
  revalidatePath(PAGE_PATH);

  if (!portrait) {
    redirect(buildRedirectUrl('error', `没有找到 ${bossId} 的派单或订单样本`));
  }

  redirect(buildRedirectUrl('success', `已生成 ${portrait.displayName}（${bossId}）的画像`));
}

async function runBatch(mode: BossPortraitBatchMode, formData: FormData) {
  await requireAccess();

  const sampleSize = clampSampleSize(formData.get('sampleSize'));
  const result = await generateBossPortraitBatch(mode, sampleSize);
  revalidatePath(PAGE_PATH);

  const modeLabel = mode === 'all' ? '全部老板画像' : '未建档老板画像';
  const failedSummary =
    result.failedCount > 0
      ? `，失败 ${result.failedCount} 个${result.failedIds.length > 0 ? `（示例：${result.failedIds.join('、')}）` : ''}`
      : '';

  redirect(
    buildRedirectUrl(
      'success',
      `${modeLabel}处理完成：候选 ${result.candidateCount} 个，新建 ${result.createdCount} 个，刷新 ${result.refreshedCount} 个${failedSummary}`,
    ),
  );
}

export async function generateAllBossProfilesAction(formData: FormData) {
  await runBatch('all', formData);
}

export async function generateMissingBossProfilesAction(formData: FormData) {
  await runBatch('missing', formData);
}
