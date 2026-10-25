import { AccountMigrationError, type AccountMigrationRoleSnapshot } from './account-migration';
export async function fetchAccountMigrationRoleSnapshot(sourceDiscordId: string | null, targetDiscordId: string | null): Promise<AccountMigrationRoleSnapshot> {
  if (!sourceDiscordId && !targetDiscordId) return { sourceRoleIds: [], targetRoleIds: [], gameRoleIds: [], reminderRoleIds: [] };
  const port = process.env.INTERNAL_API_PORT, token = process.env.INTERNAL_API_TOKEN;
  if (!port || !token) throw new AccountMigrationError('Bot 迁移核验接口未配置，请配置后再迁移', 'migration_preflight_unavailable');
  const response = await fetch(`http://${process.env.INTERNAL_API_HOST ?? '127.0.0.1'}:${port}/internal/account-migration/preflight`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Internal-Token': token },
    body: JSON.stringify({ sourceDiscordId, targetDiscordId }), signal: AbortSignal.timeout(10000), cache: 'no-store',
  }).catch(() => { throw new AccountMigrationError('暂时无法完成 Discord 核验，本次未迁移，请稍后重新预览', 'migration_preflight_unavailable'); });
  const data = await response.json().catch(() => { throw new AccountMigrationError('Discord 核验响应无效，本次未迁移', 'migration_preflight_unavailable'); }) as Record<string, unknown>;
  if (!response.ok || data.ok !== true) {
    const messages: Record<string, string> = { migration_staff_handoff_required: '旧账号仍有管理员或客服权限，请先完成权限交接', migration_target_not_in_guild: '新 Discord 账号尚未加入公会，请先加入后重新预览', invalid_migration_identity: '迁移身份核验失败，请重新登录验证' };
    throw new AccountMigrationError(messages[String(data.error)] ?? 'Discord 角色及权限暂时无法核验，本次未迁移', 'migration_preflight_unavailable');
  }
  const result = {} as AccountMigrationRoleSnapshot;
  for (const field of ['sourceRoleIds', 'targetRoleIds', 'gameRoleIds', 'reminderRoleIds'] as const) {
    if (!Array.isArray(data[field]) || data[field].some(value => typeof value !== 'string' || !/^\d{17,20}$/.test(value))) throw new AccountMigrationError('Bot 迁移核验响应不完整，本次未迁移', 'migration_preflight_unavailable');
    result[field] = [...new Set(data[field] as string[])].sort();
  }
  return result;
}
