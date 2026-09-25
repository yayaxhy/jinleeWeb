import { getPrizeArtworkPath, PRIZE_ART_BY_NAME } from './brand-artwork-catalog';

/** Shared with the Bot; approved art wins over historical database/CDN URLs. */
export const LOCAL_VOUCHER_ART_BY_PRIZE_NAME = PRIZE_ART_BY_NAME;

export const resolveLocalVoucherArt = getPrizeArtworkPath;

export function resolveVoucherDisplayArt(prizeName: string, existingImageUrl?: string | null): string | null {
  const approvedArt = resolveLocalVoucherArt(prizeName);
  if (approvedArt) return approvedArt;

  const value = existingImageUrl?.trim();
  if (!value) return null;
  // Preserve unrelated local/user-managed art, but don't return expired Discord attachments.
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net') {
      const expiresAt = url.searchParams.get('ex');
      const expiresAtMillis = expiresAt ? Number.parseInt(expiresAt, 16) * 1000 : NaN;
      if (Number.isFinite(expiresAtMillis) && expiresAtMillis <= Date.now()) return null;
    }
    return value;
  } catch {
    return null;
  }
}
