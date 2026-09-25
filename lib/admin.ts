// Access is intentionally disabled until replacement Discord IDs are approved.
const ADMIN_DISCORD_IDS: readonly string[] = [
  '525770714574225408',
  '1008032640445710447',
  '1552030874076315777',
  '308164614846414851',
  '734159747367829636',
];
const KEFU_DISCORD_IDS: readonly string[] = [];
const PEIWAN_INFO_ADMIN_DISCORD_IDS: readonly string[] = [];
const HOWARD_DISCORD_IDS: readonly string[] = [];
const IRIA_DISCORD_IDS: readonly string[] = [];
const HOWARD_READONLY_IDS: readonly string[] = [];

export const getAdminDiscordIds = () => ADMIN_DISCORD_IDS;

export const isAdminDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return ADMIN_DISCORD_IDS.includes(discordId);
};

export const isKefuDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return KEFU_DISCORD_IDS.includes(discordId);
};

export const isPeiwanInfoAdminDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return PEIWAN_INFO_ADMIN_DISCORD_IDS.includes(discordId);
};

export const isHowardDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return HOWARD_DISCORD_IDS.includes(discordId);
};

export const isIriaDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return IRIA_DISCORD_IDS.includes(discordId);
};

export const isHowardReadOnlyDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return HOWARD_READONLY_IDS.includes(discordId);
};

export const isBackofficeDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return (
    isAdminDiscordId(discordId) ||
    isKefuDiscordId(discordId) ||
    isPeiwanInfoAdminDiscordId(discordId) ||
    isHowardDiscordId(discordId) ||
    isIriaDiscordId(discordId)
  );
};

export const canViewAdminHome = (discordId?: string | null) =>
  isAdminDiscordId(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canViewKefuWorkspace = (discordId?: string | null) =>
  isKefuDiscordId(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canViewTransactions = (discordId?: string | null) =>
  isAdminDiscordId(discordId) || isKefuDiscordId(discordId) || isHowardDiscordId(discordId) || isIriaDiscordId(discordId);

export const canViewKefuTransactions = (discordId?: string | null) =>
  canViewTransactions(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canViewOrderRequests = canViewKefuTransactions;
export const canViewRefundableGifts = canViewKefuTransactions;
export const canManageBossProfiles = canViewTransactions;

export const canViewReferrals = (discordId?: string | null) =>
  isAdminDiscordId(discordId) ||
  isKefuDiscordId(discordId) ||
  isHowardDiscordId(discordId) ||
  isPeiwanInfoAdminDiscordId(discordId);

export const canManagePeiwan = (discordId?: string | null) =>
  isAdminDiscordId(discordId) || isHowardDiscordId(discordId);

export const canEditPeiwanInfo = (discordId?: string | null) =>
  canManagePeiwan(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canSyncSinglePeiwanTag = (discordId?: string | null) =>
  canManagePeiwan(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canManagePeiwanCards = (discordId?: string | null) =>
  isAdminDiscordId(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canManageGifts = (discordId?: string | null) =>
  isAdminDiscordId(discordId) || isPeiwanInfoAdminDiscordId(discordId);

export const canManageOrderChannelBindings = (discordId?: string | null) =>
  isAdminDiscordId(discordId);

export const canViewRevenue = (discordId?: string | null) =>
  isAdminDiscordId(discordId);

export const canViewStripePricing = (discordId?: string | null) => {
  void discordId;
  return false;
};

export const canViewTraffic = (discordId?: string | null) => {
  void discordId;
  return false;
};
