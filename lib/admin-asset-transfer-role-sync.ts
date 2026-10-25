type RoleSyncDependencies = {
  syncRole: (discordId: string) => Promise<string | null>;
  warn?: (message: string, details: { discordId: string }) => void;
};

/** Call only after the transfer commits. A Discord or logging failure must not
 * turn the completed database transfer into a reported transfer failure.
 */
export async function syncAssetTransferRolesAfterCommit(
  discordIds: readonly string[],
  dependencies: RoleSyncDependencies,
): Promise<string[]> {
  const warnings = await Promise.all(discordIds.map(async (discordId) => {
    try {
      return await dependencies.syncRole(discordId);
    } catch {
      // Avoid logging provider exceptions that may contain request credentials.
      try {
        (dependencies.warn ?? console.warn)('[asset-transfer] committed transfer role sync failed', { discordId });
      } catch {
        // Logging is also a post-commit side effect.
      }
      return `资产转移已完成，但 Discord 角色同步暂时失败（${discordId}），请稍后单独同步角色，无需再次转移资产。`;
    }
  }));
  return warnings.filter((warning): warning is string => Boolean(warning));
}
