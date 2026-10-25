type Evidence = {
  ownerDlmIdSnapshot?: string | null; peiwanIdSnapshot?: number | null; giftAuditIdSnapshot?: string | null;
  couponIds?: unknown; rewardSnapshot?: unknown;
};
const hasEvidence = (row: Evidence) => [row.ownerDlmIdSnapshot, row.peiwanIdSnapshot, row.giftAuditIdSnapshot,
  row.couponIds, row.rewardSnapshot].some(value => value !== undefined && value !== null);

/** Legacy duplicate rows may be deduplicated. A persisted ownership/grant proof
 * must never be deleted merely because another account has the same wall key. */
export function giftWallTransferHasEvidenceConflict<K extends string>(source: Array<Evidence & Record<K, string>>, target: Array<Evidence & Record<K, string>>, key: K): boolean {
  const targets = new Map(target.map(row => [row[key], row]));
  return source.some(row => { const other = targets.get(row[key]); return !!other && (hasEvidence(row) || hasEvidence(other)); });
}
